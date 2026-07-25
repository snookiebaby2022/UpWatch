import { createServerFn } from "@tanstack/react-start";
import { normalizeMonitorStatus } from "@/lib/monitor-status";

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
  monitors: StatusMonitor[];
  incident: string | null;
  statusPageUrl: string;
};

function siteStatusUrl() {
  return process.env.VITE_STATUS_PAGE_URL || process.env.STATUS_PAGE_URL || "https://upwatch.online/status";
}

async function fetchUpwatchStatus(userId?: string): Promise<PublicStatus> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let query = supabaseAdmin
    .from("monitors")
    .select("id, name, url, last_status, last_checked_at, user_id")
    .eq("is_public", true)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data: monitors, error: monErr } = await query;

  if (monErr) {
    console.error("[status] upwatch monitors failed", monErr);
    return {
      ok: false,
      monitors: [],
      incident: null,
      statusPageUrl: siteStatusUrl(),
    };
  }

  const rows = monitors ?? [];
  const ids = rows.map((m) => m.id);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let checks: Array<{
    monitor_id: string;
    status: string;
    response_time_ms: number | null;
    checked_at: string;
  }> = [];

  if (ids.length > 0) {
    const { data: checkRows, error: checkErr } = await supabaseAdmin
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
    const lastStatus = normalizeMonitorStatus(m.last_status as string | number | null);
    const latestStatusNum =
      lastStatus === "up" ? 1 : lastStatus === "down" ? 0 : history.length ? (history.at(-1)?.status === "up" ? 1 : 0) : 2;

    const heartbeats: StatusHeartbeat[] =
      history.length > 0
        ? history.slice(-24).map((c) => ({
            status: c.status === "up" ? 1 : c.status === "down" ? 0 : 2,
            time: c.checked_at,
            msg: "",
            ping: c.response_time_ms,
          }))
        : Array.from({ length: 24 }, () => ({
            status: latestStatusNum === 1 ? 1 : latestStatusNum === 0 ? 0 : 2,
            time: m.last_checked_at ?? "",
            msg: "",
            ping: null as number | null,
          }));

    const latest = history[history.length - 1];
    const upCount = history.filter((c) => c.status === "up").length;
    const uptime =
      history.length > 0
        ? upCount / history.length
        : lastStatus === "up" && m.last_checked_at
          ? 1
          : null;

    return {
      id: m.id,
      name: m.name,
      url: m.url,
      uptime,
      latestPing: latest?.response_time_ms ?? null,
      latestStatus: latestStatusNum,
      heartbeats,
    };
  });

  return {
    ok: true,
    monitors: mapped,
    incident: mapped.some((m) => m.latestStatus === 0) ? "Some monitors are reporting downtime" : null,
    statusPageUrl: siteStatusUrl(),
  };
}

/** Public monitors: Kuma demo widgets when anonymous, UpWatch DB when signed in. */
export const getPublicStatus = createServerFn({ method: "GET" })
  .validator((data: { userId?: string } | undefined) => data ?? {})
  .handler(async ({ data }): Promise<PublicStatus> => {
    if (data.userId) {
      return fetchUpwatchStatus(data.userId);
    }

    const { fetchKumaPublicStatus } = await import("@/lib/kuma-status.server");
    const kuma = await fetchKumaPublicStatus();
    if (kuma.ok && kuma.monitors.length > 0) {
      return kuma;
    }

    return fetchUpwatchStatus();
  });

// Back-compat alias — homepage demo reads the Kuma status page when configured.
export const getKumaStatus = getPublicStatus;
export type KumaMonitor = StatusMonitor;
export type KumaStatus = PublicStatus;
export type KumaHeartbeat = StatusHeartbeat;
