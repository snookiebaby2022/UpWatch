import {
  PLAN_CHANNELS,
  PLAN_FEATURES,
  PLAN_INTERVAL_SECONDS,
  PLAN_LABEL,
  PLAN_LIMITS,
  PLAN_ORDER,
  PLAN_PRICE,
  formatPlanInterval,
  isOverMonitorLimit,
  monitorLimitLabel,
} from "@/lib/plans";
import type { UserRow } from "./types";

export function AdminPlansTab({ users }: { users: UserRow[] }) {
  const overLimit = users.filter((u) => isOverMonitorLimit(u.plan, u.monitors_count));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-2">Plan matrix</h2>
        <p className="text-sm text-muted-foreground mb-4">
          These limits match the pricing page and are enforced by the dashboard and cron runner.
        </p>
        <div className="overflow-x-auto border border-border/60 rounded-lg">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-muted-foreground bg-card/40">
              <tr>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-left px-4 py-3">Price</th>
                <th className="text-left px-4 py-3">Monitors</th>
                <th className="text-left px-4 py-3">Cron interval</th>
                <th className="text-left px-4 py-3">Features</th>
                <th className="text-left px-4 py-3">Users</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_ORDER.map((plan) => {
                const count = users.filter((u) => u.plan === plan).length;
                return (
                  <tr key={plan} className="border-t border-border/60">
                    <td className="px-4 py-3 font-medium">{PLAN_LABEL[plan]}</td>
                    <td className="px-4 py-3 font-mono">{PLAN_PRICE[plan]}</td>
                    <td className="px-4 py-3">{monitorLimitLabel(plan)}</td>
                    <td className="px-4 py-3 font-mono">{formatPlanInterval(plan)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <ul className="space-y-0.5">
                        {PLAN_FEATURES[plan].map((f) => (
                          <li key={f}>• {f}</li>
                        ))}
                      </ul>
                      <div className="text-xs mt-2 font-mono">
                        Channels: {PLAN_CHANNELS[plan].join(", ")}
                      </div>
                    </td>
                    <td className="px-4 py-3">{count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {overLimit.length > 0 && (
        <section className="border border-red-900/40 bg-red-950/20 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-red-200 mb-3">Over monitor limit</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left py-2">User</th>
                  <th className="text-left py-2">Plan</th>
                  <th className="text-left py-2">Monitors</th>
                  <th className="text-left py-2">Limit</th>
                </tr>
              </thead>
              <tbody>
                {overLimit.map((u) => (
                  <tr key={u.id} className="border-t border-border/60">
                    <td className="py-2">{u.email ?? u.id.slice(0, 8)}</td>
                    <td className="py-2 capitalize">{u.plan}</td>
                    <td className="py-2 font-mono text-red-300">{u.monitors_count}</td>
                    <td className="py-2 font-mono">{PLAN_LIMITS[u.plan]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="border border-border/60 rounded-lg p-5 bg-card/20">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Cron reference
        </h3>
        <dl className="grid sm:grid-cols-3 gap-4 text-sm">
          {PLAN_ORDER.map((plan) => (
            <div key={plan}>
              <dt className="font-medium">{PLAN_LABEL[plan]}</dt>
              <dd className="text-muted-foreground font-mono mt-1">
                every {PLAN_INTERVAL_SECONDS[plan]}s ({formatPlanInterval(plan)})
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
