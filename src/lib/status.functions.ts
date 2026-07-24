import { createServerFn } from "@tanstack/react-start";

export type StatusHeartbeat = { status: number; time: string; msg: string; ping: number | null };

export type StatusMonitor = {
  id: string | number;
  name: string;
  url: string;
  uptime: number | null;
  latestPing: number | null;
  latestStatus: number | null;
  heartbeats: StatusHeartbeat[];
};

export type PublicStatus = {
  ok: boolean;
  source: "kuma" | "upwatch";
  monitors: StatusMonitor[];
  incident: string | null;
  statusPageUrl: string;
  kumaPublicUrl: string | null;
};

function kumaConfig() {
  const base = (process.env.KUMA_BASE_URL ?? "").replace(/\/$/, "");
  const slug = process.env.KUMA_STATUS_PAGE_SLUG || "upwatch";
  if (!base) return null;
  return { base, slug };
}

function siteStatusUrl() {
  return process.env.VITE_STATUS_PAGE_URL || process.env.STATUS_PAGE_URL || "https://upwatch.online/status";
}

async function fetchKumaStatus(base: string, slug: string): Promise<PublicStatus | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  try {
    const [configRes, hbRes] = await Promise.all([
      fetch(`${base}/api/status-page/${slug}`, {
        headers: { accept: "application/json" },
        signal: ac.signal,
      }),
      fetch(`${base}/api/status-page/heartbeat/${slug}`, {
        headers: { accept: "application/json" },
        signal: ac.signal,
      }),
    ]);
    if (!configRes.ok || !hbRes.ok) return null;

    const config = (await configRes.json()) as {
      publicGroupList?: Array<{ monitorList: Array<{ id: number; name: string; url?: string }> }>;
      incident?: { title: string; content: string } | null;
    };
    const hb = (await hbRes.json()) as {
      heartbeatList: Record<string, StatusHeartbeat[]>;
      uptimeList: Record<string, number>;
    };

    const monitors: StatusMonitor[] = [];
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
      source: "kuma",
      monitors,
      incident: config.incident ? config.incident.title : null,
      statusPageUrl: siteStatusUrl(),
      kumaPublicUrl: `${base}/status/${slug}`,
    };
  } catch (err) {
    console.error("[status] kuma fetch failed", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchUpwatchStatus(): Promise<PublicStatus> {
  const { supabase } = await import("@/integrations/supabase/client");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: monitors, error: monErr } = await supabase
    .from("monitors")
    .select("id, name, url, last_status, last_checked_at")
    .eq("is_public", true)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (monErr) {
    console.error("[status] upwatch monitors failed", monErr);
    return {
      ok: false,
      source: "upwatch",
      monitors: [],
      incident: null,
      statusPageUrl: siteStatusUrl(),
      kumaPublicUrl: null,
    };
  }

  const rows = monitors ?? [];
  const ids = rows.map((m) => m.id);
  let checks: Array<{
    monitor_id: string;
    status: string;
    response_time_ms: number | null;
    checked_at: string;
  }> = [];

  if (ids.length > 0) {
    const { data: checkRows, error: checkErr } = await supabase
      .from("check_results")
      .select("monitor_id, status, response_time_ms, checked_at")
      .in("monitor_id", ids)
      .gte("checked_at", since)
      .order("checked_at", { ascending: true })
      .limit(2000);
    if (checkErr) console.error("[status] upwatch checks failed", checkErr);
    else checks = checkRows ?? [];
  }

  const checksByMonitor = new Map<string, typeof checks>();
  for (const c of checks) {
    const list = checksByMonitor.get(c.monitor_id) ?? [];
    list.push(c);
    checksByMonitor.set(c.monitor_id, list);
  }

  const mapped: StatusMonitor[] = rows.map((m) => {
    const history = checksByMonitor.get(m.id) ?? [];
    const heartbeats: StatusHeartbeat[] = history.slice(-24).map((c) => ({
      status: c.status === "up" ? 1 : c.status === "down" ? 0 : 2,
      time: c.checked_at,
      msg: "",
      ping: c.response_time_ms,
    }));
    const latest = history[history.length - 1];
    const upCount = history.filter((c) => c.status === "up").length;
    const uptime = history.length > 0 ? upCount / history.length : null;

    return {
      id: m.id,
      name: m.name,
      url: m.url,
      uptime,
      latestPing: latest?.response_time_ms ?? null,
      latestStatus:
        m.last_status === "up" ? 1 : m.last_status === "down" ? 0 : latest ? (latest.status === "up" ? 1 : 0) : 2,
      heartbeats,
    };
  });

  return {
    ok: true,
    source: "upwatch",
    monitors: mapped,
    incident: mapped.some((m) => m.latestStatus === 0) ? "Some monitors are reporting downtime" : null,
    statusPageUrl: siteStatusUrl(),
    kumaPublicUrl: null,
  };
}

/** Try Uptime Kuma first (when configured), then UpWatch's own monitor runner. */
export const getPublicStatus = createServerFn({ method: "GET" }).handler(async (): Promise<PublicStatus> => {
  const cfg = kumaConfig();
  if (cfg) {
    const kuma = await fetchKumaStatus(cfg.base, cfg.slug);
    if (kuma) return kuma;
  }
  return fetchUpwatchStatus();
});

// Back-compat alias used by existing imports
export const getKumaStatus = getPublicStatus;
export type KumaMonitor = StatusMonitor;
export type KumaStatus = PublicStatus;
export type KumaHeartbeat = StatusHeartbeat;
