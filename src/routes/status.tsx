import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SITE_URL, OG_IMAGE } from "@/lib/site";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "Live System Status — UpWatch";
const DESC =
  "Real-time uptime for every UpWatch endpoint. Public incident history, response times, and current health for our monitoring infrastructure.";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/status` },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/status` }],
  }),
  component: StatusPage,
});

type PublicMonitor = {
  id: string;
  name: string;
  url: string;
  last_status: string | null;
  last_checked_at: string | null;
};

type CheckRow = {
  monitor_id: string;
  status: string;
  response_time_ms: number | null;
  checked_at: string;
};

function StatusPage() {
  const monitorsQuery = useQuery({
    queryKey: ["public-monitors"],
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitors")
        .select("id, name, url, last_status, last_checked_at")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PublicMonitor[];
    },
  });

  const monitors = monitorsQuery.data ?? [];
  const monitorIds = monitors.map((m) => m.id);

  const checksQuery = useQuery({
    queryKey: ["public-checks", monitorIds.join(",")],
    enabled: monitorIds.length > 0,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("check_results")
        .select("monitor_id, status, response_time_ms, checked_at")
        .in("monitor_id", monitorIds)
        .gte("checked_at", since)
        .order("checked_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as CheckRow[];
    },
  });

  const byMonitor = new Map<string, CheckRow[]>();
  for (const row of checksQuery.data ?? []) {
    const list = byMonitor.get(row.monitor_id) ?? [];
    list.push(row);
    byMonitor.set(row.monitor_id, list);
  }

  const upCount = monitors.filter((m) => m.last_status === "up").length;
  const downCount = monitors.filter((m) => m.last_status === "down").length;
  const overall =
    monitors.length === 0
      ? "unknown"
      : downCount > 0
        ? "degraded"
        : upCount === monitors.length
          ? "operational"
          : "partial";

  return (
    <div className="min-h-screen bg-bg text-zinc-300 font-sans">
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-brand animate-pulse" />
          <span className="text-white font-bold tracking-tight text-xl">UpWatch</span>
        </Link>
        <Link
          to="/"
          className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
        >
          ← Back to home
        </Link>
      </nav>
      <main className="max-w-5xl mx-auto px-6 pb-24">
        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
            Live system status
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            Real-time uptime for every public UpWatch monitor. Auto-refreshes every 30 seconds.
          </p>
        </header>

        <div className={`rounded-2xl border p-6 mb-8 flex items-center gap-4 ${
          overall === "operational"
            ? "border-brand/40 bg-brand/5"
            : overall === "degraded"
              ? "border-red-500/40 bg-red-500/5"
              : "border-brand-border bg-surface"
        }`}>
          <div className={`size-3 rounded-full ${
            overall === "operational" ? "bg-brand animate-pulse" :
            overall === "degraded" ? "bg-red-400 animate-pulse" :
            overall === "partial" ? "bg-yellow-400" : "bg-zinc-500"
          }`} />
          <div>
            <div className="text-white font-semibold text-lg">
              {overall === "operational" && "All systems operational"}
              {overall === "degraded" && "Some systems experiencing issues"}
              {overall === "partial" && "Partial outage"}
              {overall === "unknown" && "No monitors configured yet"}
            </div>
            <div className="text-xs font-mono text-zinc-500 mt-0.5">
              {monitors.length} monitor{monitors.length === 1 ? "" : "s"} · {upCount} up · {downCount} down
            </div>
          </div>
        </div>

        {monitorsQuery.isLoading ? (
          <div className="text-center py-16 text-zinc-500 font-mono text-sm">Loading status…</div>
        ) : monitorsQuery.error ? (
          <div className="text-center py-16 text-red-400 font-mono text-sm">
            Failed to load monitors.
          </div>
        ) : monitors.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 font-mono text-sm border border-dashed border-brand-border rounded-2xl">
            No public monitors yet. Add monitors from the dashboard — they'll appear here automatically.
          </div>
        ) : (
          <ul className="space-y-3">
            {monitors.map((m) => {
              const rows = byMonitor.get(m.id) ?? [];
              const latest = rows[0];
              return (
                <li
                  key={m.id}
                  className="rounded-xl border border-brand-border bg-surface/60 p-5"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate">{m.name}</div>
                      <div className="text-xs text-zinc-500 font-mono truncate">{m.url}</div>
                    </div>
                    <div className="flex items-center gap-5">
                      {typeof latest?.response_time_ms === "number" && (
                        <span className="text-xs font-mono text-zinc-500">
                          {latest.response_time_ms}ms
                        </span>
                      )}
                      {m.last_checked_at && (
                        <span className="text-xs font-mono text-zinc-500">
                          {formatAgo(m.last_checked_at)}
                        </span>
                      )}
                      <StatusPill status={m.last_status ?? "pending"} />
                    </div>
                  </div>
                  <Sparkline rows={rows} />
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-zinc-600 font-mono text-center mt-10">
          Auto-refreshes every 30s · Last updated {new Date().toLocaleTimeString()}
        </p>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    up: { label: "Operational", cls: "text-brand border-brand/40 bg-brand/10" },
    down: { label: "Down", cls: "text-red-400 border-red-500/40 bg-red-500/10" },
    pending: { label: "Pending", cls: "text-zinc-400 border-brand-border bg-surface" },
  };
  const meta = map[status] ?? map.pending;
  return (
    <span className={`text-xs font-mono px-2.5 py-1 rounded-full border ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

function Sparkline({ rows }: { rows: CheckRow[] }) {
  if (rows.length === 0) return null;
  // Bucket last 24h into ~60 slots, oldest→newest
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;
  const buckets = 60;
  const slotMs = windowMs / buckets;
  const slots: Array<"up" | "down" | "none"> = Array(buckets).fill("none");
  for (const r of rows) {
    const idx = Math.min(
      buckets - 1,
      Math.max(0, Math.floor((new Date(r.checked_at).getTime() - (now - windowMs)) / slotMs)),
    );
    if (slots[idx] === "down") continue;
    slots[idx] = r.status === "down" ? "down" : r.status === "up" ? "up" : slots[idx];
  }
  return (
    <div className="flex gap-0.5 mt-4 h-6" title="Last 24 hours">
      {slots.map((s, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${
            s === "up"
              ? "bg-brand/70"
              : s === "down"
                ? "bg-red-500/80"
                : "bg-brand-border/40"
          }`}
        />
      ))}
    </div>
  );
}

function formatAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
