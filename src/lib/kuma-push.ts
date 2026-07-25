import { KUMA_PUSH_URL } from "@/lib/site";

/** Ping Uptime Kuma push monitor so it stays green when cron runs. */
export async function pingKumaPush(opts?: {
  status?: "up" | "down";
  msg?: string;
  ping?: number;
}): Promise<{ ok: boolean; detail: string }> {
  const base =
    process.env.KUMA_PUSH_URL ??
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_KUMA_PUSH_URL) ??
    KUMA_PUSH_URL;

  if (!base) {
    return { ok: false, detail: "KUMA_PUSH_URL not configured" };
  }

  const status = opts?.status ?? "up";
  const msg = opts?.msg ?? "OK";
  const ping = opts?.ping ?? 1;
  const url = `${base.replace(/\?.*$/, "")}?status=${status}&msg=${encodeURIComponent(msg)}&ping=${ping}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text();
    const ok = body.includes('"ok"') || res.ok;
    return { ok, detail: ok ? "ok" : `HTTP ${res.status}: ${body.slice(0, 80)}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "push failed" };
  }
}
