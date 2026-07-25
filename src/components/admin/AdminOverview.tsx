import type { AdminTotals, IncidentRow, MonitorRow, TicketRow, UserRow } from "./types";
import { priorityBadgeClass, sortTicketsByPriority } from "@/lib/tickets";

export function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="border border-brand-border/60 rounded-lg px-4 py-3 bg-surface/60">
      <div className="text-xs uppercase tracking-widest text-zinc-400">{label}</div>
      <div className={`text-2xl font-semibold mt-1 text-white ${accent ?? ""}`}>{value}</div>
    </div>
  );
}

export function AdminOverview({
  totals,
  users,
  monitors,
  incidents,
  tickets,
  ticketsError,
  onOpenSupport,
}: {
  totals: AdminTotals;
  users: UserRow[];
  monitors: MonitorRow[];
  incidents: IncidentRow[];
  tickets: TicketRow[];
  ticketsError?: string | null;
  onOpenSupport?: () => void;
}) {
  const planCounts = users.reduce(
    (acc, u) => {
      acc[u.plan] = (acc[u.plan] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const openIncidents = incidents.filter((i) => !i.resolved_at).slice(0, 5);
  const recentUsers = users.slice(0, 5);
  const recentTickets = sortTicketsByPriority(tickets).slice(0, 5);
  const monitorById = new Map(monitors.map((m) => [m.id, m]));
  const pending = monitors.filter((m) => m.is_active && (!m.last_status || m.last_status === "pending")).length;
  const inactive = monitors.filter((m) => !m.is_active).length;
  const publicMonitors = monitors.filter((m) => m.is_public).length;

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Stat label="Users" value={totals.users} />
        <Stat label="Monitors" value={totals.monitors} />
        <Stat label="Up" value={totals.up} accent="text-emerald-400" />
        <Stat label="Down" value={totals.down} accent="text-red-400" />
        <Stat label="Paying" value={totals.paying} accent="text-brand" />
        <Stat label="Waitlist" value={totals.waitlist} />
        <Stat label="Open incidents" value={totals.openIncidents} accent="text-amber-400" />
        <Stat label="Open tickets" value={totals.openTickets} />
        <Stat label="Alert channels" value={totals.activeChannels} />
        <Stat label="Pending checks" value={pending} />
        <Stat label="Inactive" value={inactive} />
        <Stat label="Public monitors" value={publicMonitors} />
        <Stat
          label="Uptime"
          value={
            totals.monitors > 0
              ? `${Math.round((totals.up / totals.monitors) * 100)}%`
              : "—"
          }
          accent="text-emerald-400"
        />
      </section>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="border border-brand-border/60 rounded-lg p-5 bg-surface/40 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
            Plan distribution
          </h3>
          {(["starter", "pro", "business"] as const).map((plan) => (
            <div key={plan} className="flex items-center justify-between text-sm">
              <span className="capitalize">{plan}</span>
              <span className="font-mono">{planCounts[plan] ?? 0}</span>
            </div>
          ))}
        </div>

        <div className="border border-brand-border/60 rounded-lg p-5 bg-surface/40 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
            Recent signups
          </h3>
          {recentUsers.length === 0 ? (
            <p className="text-sm text-zinc-400">No users yet</p>
          ) : (
            recentUsers.map((u) => (
              <div key={u.id} className="text-sm flex justify-between gap-2">
                <span className="truncate">{u.email ?? u.display_name ?? u.id.slice(0, 8)}</span>
                <span className="text-zinc-400 shrink-0">
                  {new Date(u.created_at).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="border border-brand-border/60 rounded-lg p-5 bg-surface/40 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
            Open incidents
          </h3>
          {openIncidents.length === 0 ? (
            <p className="text-sm text-emerald-400">All clear</p>
          ) : (
            openIncidents.map((i) => {
              const mon = monitorById.get(i.monitor_id);
              return (
                <div key={i.id} className="text-sm">
                  <div className="font-medium truncate">{mon?.name ?? i.monitor_id.slice(0, 8)}</div>
                  <div className="text-xs text-zinc-400">
                    since {new Date(i.started_at).toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="border border-brand-border/60 rounded-lg p-5 bg-surface/40 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
            Recent support tickets
          </h3>
          {onOpenSupport && (
            <button
              type="button"
              onClick={onOpenSupport}
              className="text-xs px-3 py-1.5 border border-brand-border/60 rounded hover:border-brand text-white"
            >
              Open Support tab →
            </button>
          )}
        </div>
        {ticketsError ? (
          <p className="text-sm text-amber-300">{ticketsError}</p>
        ) : recentTickets.length === 0 ? (
          <p className="text-sm text-zinc-400">No tickets yet — users open them from /tickets</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-widest text-zinc-400">
                <tr>
                  <th className="text-left py-2">Subject</th>
                  <th className="text-left py-2">Priority</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Opened</th>
                </tr>
              </thead>
              <tbody>
                {recentTickets.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t border-brand-border/60 cursor-pointer hover:bg-surface/60"
                    onClick={onOpenSupport}
                  >
                    <td className="py-2 max-w-xs truncate">{t.subject}</td>
                    <td className="py-2">
                      <span
                        className={`inline-flex capitalize text-xs px-2 py-0.5 rounded border ${priorityBadgeClass(t.priority)}`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-2 capitalize">{t.status}</td>
                    <td className="py-2 text-zinc-400">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
