/** Transient HTTP statuses / errors worth retrying before marking a monitor down. */
export const TRANSIENT_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export type ProbeAttempt = {
  status: "up" | "down";
  statusCode: number | null;
  errorMessage: string | null;
  responseTime: number | null;
  attempts: number;
};

export type HttpProbeOptions = {
  url: string;
  region: string;
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  keyword?: string | null;
  monitorType?: string;
  userAgent?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientFailure(statusCode: number | null, errorMessage: string | null): boolean {
  if (statusCode != null && TRANSIENT_HTTP_STATUSES.has(statusCode)) return true;
  if (!errorMessage) return false;
  const msg = errorMessage.toLowerCase();
  return (
    msg.includes("abort") ||
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("socket")
  );
}

/** Single HTTP fetch attempt (no retries). */
async function fetchOnce(opts: HttpProbeOptions): Promise<Omit<ProbeAttempt, "attempts">> {
  const started = Date.now();
  const timeoutMs = opts.timeoutMs ?? 30_000;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(opts.url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": opts.userAgent ?? `UpWatch-Monitor/1.0 (${opts.region})`,
        "accept-language":
          opts.region === "eu-west"
            ? "en-GB,en;q=0.9"
            : opts.region === "ap-south"
              ? "en-IN,en;q=0.9"
              : "en-US,en;q=0.9",
      },
    });
    clearTimeout(timer);
    const responseTime = Date.now() - started;
    const statusCode = res.status;

    if (res.ok) {
      if (opts.monitorType === "keyword" && opts.keyword) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let body = "";
        const CAP = 512 * 1024;
        if (reader) {
          while (body.length < CAP) {
            const { value, done } = await reader.read();
            if (done) break;
            body += decoder.decode(value, { stream: true });
          }
          await reader.cancel().catch(() => {});
        }
        const ok = body.includes(opts.keyword);
        return {
          status: ok ? "up" : "down",
          statusCode,
          responseTime,
          errorMessage: ok ? null : `keyword "${opts.keyword}" missing`,
        };
      }
      return { status: "up", statusCode, responseTime, errorMessage: null };
    }

    return {
      status: "down",
      statusCode,
      responseTime,
      errorMessage: `HTTP ${statusCode}`,
    };
  } catch (err) {
    return {
      status: "down",
      statusCode: null,
      responseTime: Date.now() - started,
      errorMessage: err instanceof Error ? err.message : "check failed",
    };
  }
}

/**
 * Probe with retries — only marks down after repeated transient failures.
 * Default: 3 attempts, 30s timeout, 2s between retries (matches Kuma 2 retries).
 */
export async function probeHttpWithRetries(opts: HttpProbeOptions): Promise<ProbeAttempt> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  const retryDelayMs = opts.retryDelayMs ?? 2_000;

  let last: Omit<ProbeAttempt, "attempts"> = {
    status: "down",
    statusCode: null,
    errorMessage: "check failed",
    responseTime: null,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await fetchOnce(opts);
    if (last.status === "up") {
      return { ...last, attempts: attempt };
    }
    const retryable = attempt < maxAttempts && isTransientFailure(last.statusCode, last.errorMessage);
    if (!retryable) break;
    await sleep(retryDelayMs);
  }

  const detail =
    maxAttempts > 1 && last.status === "down"
      ? `${last.errorMessage ?? "down"} (${maxAttempts} attempts)`
      : last.errorMessage;
  return { ...last, errorMessage: detail, attempts: maxAttempts };
}
