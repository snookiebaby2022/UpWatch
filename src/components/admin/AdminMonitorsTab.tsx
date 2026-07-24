import { Input } from "@/components/ui/input";
import type { MonitorRow, UserRow } from "./types";

function formatInterval(seconds: number) {
  if (seconds >= 3600) return `${seconds / 3600}h`;
  if (seconds >= 60) return `${seconds / 60}m`;
  return `${seconds}s`;
}

export function AdminMonitorsTab({
  monitors,
  users,
  search,
  onSearchChange,
  onToggleActive,
}: {
  monitors: MonitorRow[];
  users: UserRow[];
  search: string;
  onSearchChange: (v: string) => void;
  onToggleActive: (monitorId: string, isActive: boolean) => void;
}) {
  const userById = new Map(users.map((u) => [u.id, u]));
  const q = search.trim().toLowerCase();
  const filtered = monitors.filter((m) => {
    if (!q) return true;
    const owner = userById.get(m.user_id);
    return (
      m.name.toLowerCase().includes(q) ||
      m.url.toLowerCase().includes(q) ||
      (m.last_status ?? "").includes(q) ||
      owner?.email?.toLowerCase().includes(q) ||
      owner?.display_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search monitors by name, URL, owner…"
        className="max-w-md bg-background"
      />
      <div className="overflow-x-auto border border-border/60 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">URL</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Interval</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Active</th>
              <th className="text-left px-4 py-3">Last check</th>
              <th className="text-left px-4 py-3">Owner</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const owner = userById.get(m.user_id);
              return (
                <tr key={m.id} className="border-t border-border/60">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-xs">
                    {m.url}
                  </td>
                  <td className="px-4 py-3 capitalize">{m.type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatInterval(m.interval_seconds)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        m.last_status === "up"
                          ? "text-emerald-400"
                          : m.last_status === "down"
                            ? "text-red-400"
                            : "text-muted-foreground"
                      }
                    >
                      {m.last_status ?? "pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={m.is_active ? "text-emerald-400" : "text-muted-foreground"}>
                      {m.is_active ? "yes" : "paused"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {m.last_checked_at ? new Date(m.last_checked_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div>{owner?.email ?? owner?.display_name ?? "—"}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{m.user_id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onToggleActive(m.id, !m.is_active)}
                      className="text-xs px-2 py-1 border border-border/60 rounded hover:border-brand"
                    >
                      {m.is_active ? "Pause" : "Enable"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                  No monitors match your search
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
