import type { PublicStatus, StatusHeartbeat, StatusMonitor } from "@/lib/status.functions";
import { KUMA_PUBLIC_URL } from "@/lib/site";
import { fetchKumaMetricsMonitors } from "@/lib/kuma-metrics.server";

type KumaStatusPageResponse = {
  incident?: { title?: string } | null;
  publicGroupList?: Array<{
    monitorList?: Array<{
      id: number;
      name: string;
      type: string;
      sendUrl?: number | boolean;
      url?: string;
    }>;
  }>;
};

type KumaHeartbeatResponse = {
  heartbeatList?: Record<string, Array<{ status: number; time: string; msg: string; ping: number | null }>>;
  uptimeList?: Record<string, number>;
};

function kumaBaseUrl() {
  return process.env.KUMA_BASE_URL?.replace(/\/$/, "") || "https://status.upwatch.online";
}

function kumaStatusSlug() {
  return process.env.KUMA_STATUS_PAGE_SLUG?.trim() || "upwatch";
}

async function fetchStatusPagePayload() {
  const base = kumaBaseUrl();
  const slug = kumaStatusSlug();

  const [pageRes, heartbeatRes] = await Promise.all([
    fetch(`${base}/api/status-page/${slug}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    }),
    fetch(`${base}/api/status-page/heartbeat/${slug}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    }),
  ]);

  if (!pageRes.ok || !heartbeatRes.ok) {
    console.warn("[status] kuma fetch failed", pageRes.status, heartbeatRes.status);
    return null;
  }

  return {
    page: (await pageRes.json()) as KumaStatusPageResponse,
    beats: (await heartbeatRes.json()) as KumaHeartbeatResponse,
  };
}

function mapStatusPageMonitors(
  page: KumaStatusPageResponse,
  beats: KumaHeartbeatResponse,
): StatusMonitor[] {
  const rawMonitors = page.publicGroupList?.flatMap((g) => g.monitorList ?? []) ?? [];
  const visible = rawMonitors.filter((m) => m.type !== "push");

  return visible.map((m) => {
    const id = String(m.id);
    const history = beats.heartbeatList?.[id] ?? [];
    const last24 = history.slice(-24);
    const latest = history[history.length - 1];
    const uptimeKey = `${m.id}_24`;
    const uptime = beats.uptimeList?.[uptimeKey] ?? null;

    const heartbeats: StatusHeartbeat[] =
      last24.length > 0
        ? last24.map((h) => ({
            status: h.status,
            time: h.time,
            msg: h.msg ?? "",
            ping: h.ping,
          }))
        : Array.from({ length: 24 }, () => ({
            status: 2,
            time: "",
            msg: "",
            ping: null as number | null,
          }));

    const showUrl = m.sendUrl === true || m.sendUrl === 1 ? (m.url?.trim() ?? "") : "";
    const url = showUrl && showUrl !== "https://" ? showUrl : "";

    return {
      id: `kuma-${m.id}`,
      name: m.name,
      url,
      uptime,
      latestPing: latest?.ping ?? null,
      latestStatus: latest?.status ?? 2,
      heartbeats,
    };
  });
}

function mapMetricsMonitors(
  metricsMonitors: NonNullable<Awaited<ReturnType<typeof fetchKumaMetricsMonitors>>>,
  beats: KumaHeartbeatResponse,
): StatusMonitor[] {
  return metricsMonitors.map((m) => {
    const history = beats.heartbeatList?.[m.id] ?? [];
    const last24 = history.slice(-24);
    const latest = history[history.length - 1];
    const uptimeKey = `${m.id}_24`;
    const uptime = beats.uptimeList?.[uptimeKey] ?? m.uptime24;

    const heartbeats: StatusHeartbeat[] =
      last24.length > 0
        ? last24.map((h) => ({
            status: h.status,
            time: h.time,
            msg: h.msg ?? "",
            ping: h.ping,
          }))
        : Array.from({ length: 24 }, () => ({
            status: m.latestStatus,
            time: "",
            msg: "",
            ping: m.latestPing,
          }));

    return {
      id: `kuma-${m.id}`,
      name: m.name,
      url: m.url,
      uptime,
      latestPing: latest?.ping ?? m.latestPing,
      latestStatus: latest?.status ?? m.latestStatus,
      heartbeats,
    };
  });
}

/** All Kuma demo monitors for the homepage — prefers /metrics (every monitor), falls back to status page. */
export async function fetchKumaPublicStatus(): Promise<PublicStatus> {
  const statusPageUrl = KUMA_PUBLIC_URL;

  try {
    const [metricsMonitors, statusPayload] = await Promise.all([
      fetchKumaMetricsMonitors(),
      fetchStatusPagePayload(),
    ]);

    const beats = statusPayload?.beats ?? { heartbeatList: {}, uptimeList: {} };
    const incident = statusPayload?.page.incident?.title ?? null;

    let monitors: StatusMonitor[] = [];

    if (metricsMonitors && metricsMonitors.length > 0) {
      monitors = mapMetricsMonitors(metricsMonitors, beats);
    } else if (statusPayload) {
      monitors = mapStatusPageMonitors(statusPayload.page, beats);
    } else {
      return { ok: false, monitors: [], incident: null, statusPageUrl };
    }

    monitors.sort((a, b) => a.name.localeCompare(b.name));

    const resolvedIncident =
      incident ??
      (monitors.some((m) => m.latestStatus === 0) ? "Some demo monitors are reporting downtime" : null);

    return {
      ok: true,
      monitors,
      incident: resolvedIncident,
      statusPageUrl,
    };
  } catch (err) {
    console.error("[status] kuma status error", err);
    return { ok: false, monitors: [], incident: null, statusPageUrl };
  }
}
