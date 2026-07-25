import type { PublicStatus, StatusHeartbeat, StatusMonitor } from "@/lib/status.functions";
import { KUMA_PUBLIC_URL } from "@/lib/site";

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

/** Monitors on the public Kuma status page — used for homepage demo widgets. */
export async function fetchKumaPublicStatus(): Promise<PublicStatus> {
  const base = kumaBaseUrl();
  const slug = kumaStatusSlug();
  const statusPageUrl = KUMA_PUBLIC_URL;

  try {
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
      return { ok: false, monitors: [], incident: null, statusPageUrl };
    }

    const page = (await pageRes.json()) as KumaStatusPageResponse;
    const beats = (await heartbeatRes.json()) as KumaHeartbeatResponse;

    const rawMonitors =
      page.publicGroupList?.flatMap((g) => g.monitorList ?? []) ?? [];

    // Hide internal push heartbeats from customer-facing demo widgets.
    const visible = rawMonitors.filter((m) => m.type !== "push");

    const mapped: StatusMonitor[] = visible.map((m) => {
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

      const showUrl =
        m.sendUrl === true || m.sendUrl === 1 ? (m.url?.trim() ?? "") : "";
      const url =
        showUrl && showUrl !== "https://" ? showUrl : "";

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

    mapped.sort((a, b) => a.name.localeCompare(b.name));

    const incident =
      page.incident?.title ??
      (mapped.some((m) => m.latestStatus === 0) ? "Some demo monitors are reporting downtime" : null);

    return {
      ok: true,
      monitors: mapped,
      incident,
      statusPageUrl,
    };
  } catch (err) {
    console.error("[status] kuma status error", err);
    return { ok: false, monitors: [], incident: null, statusPageUrl };
  }
}
