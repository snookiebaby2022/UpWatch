import { Link } from "@tanstack/react-router";
import type { PublicStatus, StatusMonitor } from "@/lib/status.functions";
import { KUMA_PUBLIC_URL, STATUS_PAGE_URL } from "@/lib/site";

export function StatusSourceBadge({ source }: { source: PublicStatus["source"] }) {
  return (
    <span className="text-[10px] uppercase tracking-widest font-mono text-zinc-500">
      {source === "kuma" ? "Uptime Kuma" : "UpWatch monitors"}
    </span>
  );
}

export function StatusMonitorList({
  monitors,
  loading,
  failed,
  compact,
}: {
  monitors: StatusMonitor[];
  loading?: boolean;
  failed?: boolean;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <div className="text-sm text-zinc-500 py-8 text-center font-mono">Waiting for heartbeats…</div>
    );
  }
  if (failed) {
    return (
      <div className="text-sm text-zinc-500 py-8 text-center font-mono border border-dashed border-brand-border rounded-xl">
        Couldn't reach the status feed. Retrying automatically…
      </div>
    );
  }
  if (monitors.length === 0) {
    return (
      <div className="text-sm text-zinc-500 py-8 text-center font-mono border border-dashed border-brand-border rounded-xl">
        No public monitors yet. Add monitors from your dashboard and mark them public.
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-3"}>
      {monitors.map((m) => (
        <StatusMonitorRow key={String(m.id)} monitor={m} compact={compact} />
      ))}
    </div>
  );
}

export function StatusMonitorRow({ monitor, compact }: { monitor: StatusMonitor; compact?: boolean }) {
  const beats = monitor.heartbeats.length
    ? monitor.heartbeats
    : Array.from({ length: 20 }, () => ({ status: 2, time: "", msg: "", ping: null }));
  const uptime = monitor.uptime != null ? `${(monitor.uptime * 100).toFixed(2)}%` : "—";
  const isUp = monitor.latestStatus === 1;

  if (compact) {
    return (
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="w-48 min-w-0">
          <div className="text-white font-medium truncate">{monitor.name}</div>
          <div className="text-xs text-zinc-500 font-mono truncate">
            {monitor.latestPing != null ? `${monitor.latestPing}ms` : "no data"}
          </div>
        </div>
        <HeartbeatBar beats={beats} />
        <div className="text-right w-20">
          <div className="text-brand font-mono text-sm">{uptime}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-border bg-surface/60 p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-white font-semibold truncate">{monitor.name}</div>
          <div className="text-xs text-zinc-500 font-mono truncate">{monitor.url}</div>
        </div>
        <div className="flex items-center gap-5">
          {monitor.latestPing != null && (
            <span className="text-xs font-mono text-zinc-500">{monitor.latestPing}ms</span>
          )}
          <span className="text-brand font-mono text-sm">{uptime}</span>
          <span
            className={`text-xs font-mono px-2.5 py-1 rounded-full border ${
              isUp
                ? "text-brand border-brand/40 bg-brand/10"
                : monitor.latestStatus === 0
                  ? "text-red-400 border-red-500/40 bg-red-500/10"
                  : "text-zinc-400 border-brand-border bg-surface"
            }`}
          >
            {isUp ? "Operational" : monitor.latestStatus === 0 ? "Down" : "Pending"}
          </span>
        </div>
      </div>
      <div className="mt-4">
        <HeartbeatBar beats={beats} tall />
      </div>
    </div>
  );
}

function HeartbeatBar({ beats, tall }: { beats: StatusMonitor["heartbeats"]; tall?: boolean }) {
  return (
    <div className={`flex-1 flex gap-1 items-end ${tall ? "h-6" : "h-8"}`}>
      {beats.map((b, i) => {
        const color =
          b.status === 1
            ? "bg-brand/20 border-brand"
            : b.status === 2
              ? "bg-yellow-500/20 border-yellow-500"
              : b.status === 0
                ? "bg-zinc-800 border-zinc-700"
                : "bg-red-500/20 border-red-500";
        const h =
          b.status === 1 ? (tall ? "h-5" : "h-6") : b.status === 2 ? "h-4" : b.status === 0 ? "h-3" : "h-5";
        return <div key={i} className={`flex-1 rounded-sm border-b-2 ${h} ${color}`} />;
      })}
    </div>
  );
}

export function StatusPageLinks({
  source,
  kumaPublicUrl,
}: {
  source: PublicStatus["source"];
  kumaPublicUrl: string | null;
}) {
  const external = kumaPublicUrl || KUMA_PUBLIC_URL || null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs font-mono uppercase tracking-widest text-zinc-500">
      <Link to="/status" className="hover:text-brand transition-colors">
        {STATUS_PAGE_URL.replace("https://", "")}
      </Link>
      {source === "kuma" && external && (
        <a href={external} target="_blank" rel="noopener noreferrer" className="hover:text-brand transition-colors">
          Kuma status page →
        </a>
      )}
    </div>
  );
}

export function OverallStatusBanner({
  monitors,
  incident,
}: {
  monitors: StatusMonitor[];
  incident: string | null;
}) {
  const down = monitors.filter((m) => m.latestStatus === 0).length;
  const up = monitors.filter((m) => m.latestStatus === 1).length;
  const overall =
    monitors.length === 0 ? "unknown" : down > 0 ? "degraded" : up === monitors.length ? "operational" : "partial";

  return (
    <div
      className={`rounded-2xl border p-6 mb-8 flex items-center gap-4 ${
        overall === "operational"
          ? "border-brand/40 bg-brand/5"
          : overall === "degraded"
            ? "border-red-500/40 bg-red-500/5"
            : "border-brand-border bg-surface"
      }`}
    >
      <div
        className={`size-3 rounded-full ${
          overall === "operational"
            ? "bg-brand animate-pulse"
            : overall === "degraded"
              ? "bg-red-400 animate-pulse"
              : overall === "partial"
                ? "bg-yellow-400"
                : "bg-zinc-500"
        }`}
      />
      <div>
        <div className="text-white font-semibold text-lg">
          {overall === "operational" && "All systems operational"}
          {overall === "degraded" && (incident || "Some systems experiencing issues")}
          {overall === "partial" && "Partial outage"}
          {overall === "unknown" && "No monitors configured yet"}
        </div>
        <div className="text-xs font-mono text-zinc-500 mt-0.5">
          {monitors.length} monitor{monitors.length === 1 ? "" : "s"} · {up} up · {down} down
        </div>
      </div>
    </div>
  );
}
