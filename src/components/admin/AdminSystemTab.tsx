import { useState } from "react";
import { BUILD_LABEL } from "@/lib/build";
import {
  PLAN_FEATURES,
  PLAN_INTERVAL_SECONDS,
  PLAN_LABEL,
  PLAN_LIMITS,
  PLAN_ORDER,
  PLAN_PRICE,
  formatPlanInterval,
  isOverMonitorLimit,
  monitorLimitLabel,
  planAllowsChannel,
} from "@/lib/plans";
import { KUMA_PUBLIC_URL, STATUS_PAGE_URL } from "@/lib/site";
import type { ChannelRow, UserRow } from "./types";

type HealthCheck = {
  name: string;
  url: string;
  status: "idle" | "loading" | "ok" | "fail";
  detail: string;
};

export function AdminSystemTab({
  users,
  channels,
}: {
  users: UserRow[];
  channels: ChannelRow[];
}) {
  const [checks, setChecks] = useState<HealthCheck[]>([
    {
      name: "Kuma status API",
      url: "https://status.upwatch.online/api/status-page/upwatch",
      status: "idle",
      detail: "",
    },
    {
      name: "Kuma push endpoint",
      url: "https://status.upwatch.online/api/push/5pyQgQR1m8?status=up&msg=OK&ping=1",
      status: "idle",
      detail: "",
    },
    { name: "UpWatch status page", url: STATUS_PAGE_URL, status: "idle", detail: "" },
    { name: "Public status (Kuma)", url: KUMA_PUBLIC_URL, status: "idle", detail: "" },
  ]);
  const [running, setRunning] = useState(false);

  async function runHealthChecks() {
    setRunning(true);
    const next = await Promise.all(
      checks.map(async (c) => {
        try {
          const res = await fetch(c.url, { method: "GET", mode: "cors" });
          return {
            ...c,
            status: res.ok ? ("ok" as const) : ("fail" as const),
            detail: `HTTP ${res.status}`,
          };
        } catch (err) {
          return {
            ...c,
            status: "fail" as const,
            detail: err instanceof Error ? err.message : "Request failed",
          };
        }
      }),
    );
    setChecks(next);
    setRunning(false);
  }

  const cronRows = PLAN_ORDER.map((plan) => ({
    plan: PLAN_LABEL[plan],
    interval: formatPlanInterval(plan),
    monitors: monitorLimitLabel(plan),
  }));

  const overLimit = users.filter((u) => isOverMonitorLimit(u.plan, u.monitors_count));
  const badChannels = channels.filter((c) => !planAllowsChannel(
    users.find((u) => u.id === c.user_id)?.plan ?? "starter",
    c.type,
  ));

  return (
    <div className="space-y-8">
      <section className="border border-brand/30 bg-brand/5 rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Admin Console v2</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Overview, Users, Monitors, Waitlist, Incidents, Channels, Support, Plans, and System tabs.
              Manage subscriptions, resolve incidents, reply to tickets, and inspect platform health.
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="text-muted-foreground">Build</div>
            <div className="font-mono text-brand">{BUILD_LABEL}</div>
          </div>
        </div>
        <p className="text-xs text-amber-300/90 mt-4 border-t border-brand/20 pt-4">
          Still seeing the old &quot;Admin Dashboard&quot; with a Moderators card? Production has not been
          redeployed — merge to main and run the GitHub Deploy workflow with Cloudflare secrets.
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="border border-border/60 rounded-lg p-5 bg-card/20 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Cron check intervals
          </h3>
          <p className="text-sm text-muted-foreground">
            pg_cron hits <span className="font-mono text-xs">/api/public/hooks/run-monitors</span> every minute.
            Monitors run when their plan interval has elapsed.
          </p>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left py-2">Plan</th>
                <th className="text-left py-2">Interval</th>
                <th className="text-left py-2">Monitors</th>
              </tr>
            </thead>
            <tbody>
              {cronRows.map((row) => (
                <tr key={row.plan} className="border-t border-border/60">
                  <td className="py-2">{row.plan}</td>
                  <td className="py-2 font-mono">{row.interval}</td>
                  <td className="py-2">{row.monitors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-border/60 rounded-lg p-5 bg-card/20 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Plan pricing (live copy)
          </h3>
          {PLAN_ORDER.map((plan) => (
            <div key={plan} className="border border-border/40 rounded-md p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{PLAN_LABEL[plan]}</span>
                <span className="font-mono text-brand">
                  {PLAN_PRICE[plan]}
                  {plan !== "starter" ? "/mo" : ""}
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {PLAN_FEATURES[plan].map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {(overLimit.length > 0 || badChannels.length > 0) && (
        <section className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-amber-200">Plan enforcement alerts</h3>
          {overLimit.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {overLimit.length} user(s) over monitor limit:{" "}
              {overLimit.map((u) => u.email ?? u.id.slice(0, 8)).join(", ")}
            </p>
          )}
          {badChannels.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {badChannels.length} channel(s) on a plan that does not include that integration.
            </p>
          )}
        </section>
      )}

      <section className="border border-border/60 rounded-lg p-5 bg-card/20 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            External health checks
          </h3>
          <button
            type="button"
            onClick={runHealthChecks}
            disabled={running}
            className="text-sm px-4 py-2 rounded-md border border-border/60 hover:bg-card/40 disabled:opacity-50"
          >
            {running ? "Checking…" : "Run checks"}
          </button>
        </div>
        <ul className="space-y-2">
          {checks.map((c) => (
            <li
              key={c.name}
              className="flex flex-wrap items-center justify-between gap-2 text-sm border border-border/40 rounded-md px-3 py-2"
            >
              <span>{c.name}</span>
              <span
                className={
                  c.status === "ok"
                    ? "text-emerald-400"
                    : c.status === "fail"
                      ? "text-red-400"
                      : "text-muted-foreground"
                }
              >
                {c.status === "idle" ? "Not run" : c.detail || c.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
