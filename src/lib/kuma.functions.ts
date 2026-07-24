import { createServerFn } from "@tanstack/react-start";

const KUMA_BASE = "https://status.upwatch.online";
const KUMA_SLUG = "demo";

export type KumaHeartbeat = { status: number; time: string; msg: string; ping: number | null };
export type KumaMonitor = {
  id: number;
  name: string;
  url: string;
  uptime: number | null;
  latestPing: number | null;
  latestStatus: number | null;
  heartbeats: KumaHeartbeat[];
};
export type KumaStatus = {
  ok: boolean;
  monitors: KumaMonitor[];
  incident: string | null;
};

export const getKumaStatus = createServerFn({ method: "GET" }).handler(async (): Promise<KumaStatus> => {
  // Bound both external requests so a slow/hung upstream can never stall SSR
  // or a client fetch beyond a few seconds.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  try {
    const [configRes, hbRes] = await Promise.all([
      fetch(`${KUMA_BASE}/api/status-page/${KUMA_SLUG}`, { headers: { accept: "application/json" }, signal: ac.signal }),
      fetch(`${KUMA_BASE}/api/status-page/heartbeat/${KUMA_SLUG}`, { headers: { accept: "application/json" }, signal: ac.signal }),
    ]);
    if (!configRes.ok || !hbRes.ok) return { ok: false, monitors: [], incident: null };

    const config = (await configRes.json()) as {
      publicGroupList?: Array<{ monitorList: Array<{ id: number; name: string; url?: string }> }>;
      incident?: { title: string; content: string } | null;
    };
    const hb = (await hbRes.json()) as {
      heartbeatList: Record<string, KumaHeartbeat[]>;
      uptimeList: Record<string, number>;
    };

    const monitors: KumaMonitor[] = [];
    for (const group of config.publicGroupList ?? []) {
      for (const m of group.monitorList ?? []) {
        const beats = hb.heartbeatList?.[String(m.id)] ?? [];
        const latest = beats[beats.length - 1];
        monitors.push({
          id: m.id,
          name: m.name,
          url: m.url ?? "",
          uptime: hb.uptimeList?.[`${m.id}_24`] ?? hb.uptimeList?.[String(m.id)] ?? null,
          latestPing: latest?.ping ?? null,
          latestStatus: latest?.status ?? null,
          heartbeats: beats.slice(-24),
        });
      }
    }

    return {
      ok: true,
      monitors,
      incident: config.incident ? config.incident.title : null,
    };
  } catch (err) {
    // Timeout, DNS failure, upstream 5xx, malformed JSON — all fall through
    // to a safe empty payload so the UI can render its "unavailable" state.
    console.error("[kuma] fetch failed", err);
    return { ok: false, monitors: [], incident: null };
  } finally {
    clearTimeout(timer);
  }
});

