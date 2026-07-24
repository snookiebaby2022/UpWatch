import { Input } from "@/components/ui/input";
import type { IncidentRow, MonitorRow } from "./types";

export function AdminIncidentsTab({
  incidents,
  monitors,
  search,
  filter,
  onSearchChange,
  onFilterChange,
  onResolve,
}: {
  incidents: IncidentRow[];
  monitors: MonitorRow[];
  search: string;
  filter: "all" | "open" | "resolved";
  onSearchChange: (v: string) => void;
  onFilterChange: (v: "all" | "open" | "resolved") => void;
  onResolve: (id: string) => void;
}) {
  const monitorById = new Map(monitors.map((m) => [m.id, m]));
  const q = search.trim().toLowerCase();

  const filtered = incidents.filter((i) => {
    if (filter === "open" && i.resolved_at) return false;
    if (filter === "resolved" && !i.resolved_at) return false;
    if (!q) return true;
    const mon = monitorById.get(i.monitor_id);
    return (
      mon?.name.toLowerCase().includes(q) ||
      mon?.url.toLowerCase().includes(q) ||
      (i.error_message ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search incidents by monitor or error…"
          className="max-w-md bg-background"
        />
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as "all" | "open" | "resolved")}
          className="bg-background border border-border/60 rounded px-3 py-2 text-sm"
        >
          <option value="all">All incidents</option>
          <option value="open">Open only</option>
          <option value="resolved">Resolved only</option>
        </select>
      </div>
      <div className="overflow-x-auto border border-border/60 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Monitor</th>
              <th className="text-left px-4 py-3">Started</th>
              <th className="text-left px-4 py-3">Resolved</th>
              <th className="text-left px-4 py-3">Duration</th>
              <th className="text-left px-4 py-3">Error</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const mon = monitorById.get(i.monitor_id);
              const end = i.resolved_at ? new Date(i.resolved_at) : new Date();
              const mins = Math.round((end.getTime() - new Date(i.started_at).getTime()) / 60000);
              return (
                <tr key={i.id} className="border-t border-border/60">
                  <td className="px-4 py-3">
                    <div>{mon?.name ?? i.monitor_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate max-w-xs">
                      {mon?.url}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(i.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {i.resolved_at ? (
                      <span className="text-emerald-400">{new Date(i.resolved_at).toLocaleString()}</span>
                    ) : (
                      <span className="text-red-400">Ongoing</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h ${mins % 60}m`}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-md">
                    {i.error_message ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!i.resolved_at && (
                      <button
                        onClick={() => onResolve(i.id)}
                        className="text-xs px-2 py-1 border border-border/60 rounded hover:border-brand"
                      >
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No incidents match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
