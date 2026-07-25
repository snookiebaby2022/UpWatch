type ParsedMonitor = {
  id: string;
  name: string;
  type: string;
  url: string;
  latestStatus: number;
  latestPing: number | null;
  uptime24: number | null;
};

function parsePrometheusLabels(raw: string): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const match of raw.matchAll(/([\w]+)="((?:\\.|[^"\\])*)"/g)) {
    labels[match[1]] = match[2].replace(/\\"/g, '"');
  }
  return labels;
}

/** Parse Kuma /metrics — lists every active monitor (no status-page assignment needed). */
export function parseKumaPrometheusMetrics(body: string): ParsedMonitor[] {
  const byId = new Map<
    string,
    { name: string; type: string; url: string; latestStatus: number; latestPing: number | null; uptime24: number | null }
  >();

  for (const line of body.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{([^}]*)\}\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|NaN|Inf|-Inf)/);
    if (!match) continue;

    const metric = match[1];
    const labels = parsePrometheusLabels(match[2]);
    const value = Number(match[3]);
    const id = labels.monitor_id;
    if (!id) continue;

    const type = labels.monitor_type ?? "";
    if (type === "push" || type === "group") continue;

    const entry =
      byId.get(id) ??
      {
        name: labels.monitor_name ?? `Monitor ${id}`,
        type,
        url: labels.monitor_url ?? "",
        latestStatus: 2,
        latestPing: null,
        uptime24: null,
      };

    if (labels.monitor_name) entry.name = labels.monitor_name;
    if (labels.monitor_type) entry.type = labels.monitor_type;
    if (labels.monitor_url && labels.monitor_url !== "https://" && labels.monitor_url !== "null") {
      entry.url = labels.monitor_url;
    }

    if (metric === "monitor_status" && Number.isFinite(value)) {
      entry.latestStatus = value;
    } else if (metric === "monitor_response_time" && Number.isFinite(value)) {
      entry.latestPing = Math.round(value);
    } else if (metric === "monitor_uptime_ratio" && labels.period === "24h" && Number.isFinite(value)) {
      entry.uptime24 = value;
    }

    byId.set(id, entry);
  }

  const demoTypes = new Set(["http", "https", "keyword", "json-query", "ping", "tcp", "dns", "docker", "steam"]);
  return [...byId.entries()]
    .map(([id, m]) => ({ id, ...m }))
    .filter((m) => demoTypes.has(m.type))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function metricsAuthHeaders(): HeadersInit | null {
  const apiKey = process.env.KUMA_METRICS_API_KEY?.trim();
  if (apiKey) return { Authorization: `Bearer ${apiKey}` };

  const user = process.env.KUMA_METRICS_USERNAME?.trim();
  const pass = process.env.KUMA_METRICS_PASSWORD ?? "";
  if (user) {
    const token = Buffer.from(`${user}:${pass}`).toString("base64");
    return { Authorization: `Basic ${token}` };
  }

  return null;
}

/** Fetch all Kuma HTTP monitors via Prometheus /metrics (requires API key or basic auth on Kuma). */
export async function fetchKumaMetricsMonitors(): Promise<ParsedMonitor[] | null> {
  const base = process.env.KUMA_BASE_URL?.replace(/\/$/, "") || "https://status.upwatch.online";
  const auth = metricsAuthHeaders();
  if (!auth) return null;

  try {
    const res = await fetch(`${base}/metrics`, {
      headers: { ...auth, Accept: "text/plain" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn("[status] kuma metrics fetch failed", res.status);
      return null;
    }
    const text = await res.text();
    const monitors = parseKumaPrometheusMetrics(text);
    return monitors.length > 0 ? monitors : null;
  } catch (err) {
    console.error("[status] kuma metrics error", err);
    return null;
  }
}
