import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { KUMA_PUSH_URL } from "@/lib/site";
import type { ChannelRow, UserRow } from "./types";

type HealthCheck = {
  name: string;
  status: "idle" | "loading" | "ok" | "fail";
  detail: string;
};

const CHECK_NAMES = [
  "Kuma status API",
  "Kuma push API",
  "UpWatch status page",
  "Public status (Kuma)",
] as const;

export function AdminSystemTab({
  users,
  channels,
}: {
  users: UserRow[];
  channels: ChannelRow[];
}) {
  const [checks, setChecks] = useState<HealthCheck[]>(
    CHECK_NAMES.map((name) => ({ name, status: "idle", detail: "" })),
  );
  const [running, setRunning] = useState(false);

  async function runHealthChecks() {
    setRunning(true);
    setChecks(CHECK_NAMES.map((name) => ({ name, status: "loading", detail: "" })));

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setChecks(CHECK_NAMES.map((name) => ({ name, status: "fail", detail: "Not signed in" })));
        return;
      }

      const res = await fetch("/api/admin/health-checks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        checks?: Array<{ name: string; ok: boolean; detail: string }>;
        error?: string;
      };

      if (!res.ok || !body.checks) {
        setChecks(CHECK_NAMES.map((name) => ({
          name,
          status: "fail",
          detail: body.error ?? `HTTP ${res.status}`,
        })));
        return;
      }

      setChecks(
        body.checks.map((c) => ({
          name: c.name,
          status: c.ok ? "ok" : "fail",
          detail: c.detail,
        })),
      );
    } catch (err) {
      setChecks(CHECK_NAMES.map((name) => ({
        name,
        status: "fail",
        detail: err instanceof Error ? err.message : "Request failed",
      })));
    } finally {
      setRunning(false);
    }
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
            <h2 className="text-lg font-semibold text-white">Admin Console v2</h2>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Overview, Users, Monitors, Waitlist, Incidents, Channels, Support, Plans, and System tabs.
              Manage subscriptions, resolve incidents, reply to tickets, and inspect platform health.
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="text-zinc-500">Build</div>
            <div className="font-mono text-brand">{BUILD_LABEL}</div>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="border border-brand-border rounded-lg p-5 bg-surface/60 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Cron check intervals
          </h3>
          <p className="text-sm text-zinc-400">
            pg_cron hits <span className="font-mono text-xs">/api/public/hooks/run-monitors</span> every minute.
            Monitors run when their plan interval has elapsed.
          </p>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="text-left py-2">Plan</th>
                <th className="text-left py-2">Interval</th>
                <th className="text-left py-2">Monitors</th>
              </tr>
            </thead>
            <tbody>
              {cronRows.map((row) => (
                <tr key={row.plan} className="border-t border-brand-border/60">
                  <td className="py-2 text-zinc-300">{row.plan}</td>
                  <td className="py-2 font-mono text-zinc-300">{row.interval}</td>
                  <td className="py-2 text-zinc-300">{row.monitors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-brand-border rounded-lg p-5 bg-surface/60 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Plan pricing (live copy)
          </h3>
          {PLAN_ORDER.map((plan) => (
            <div key={plan} className="border border-brand-border/60 rounded-md p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-white">{PLAN_LABEL[plan]}</span>
                <span className="font-mono text-brand">
                  {PLAN_PRICE[plan]}
                  {plan !== "starter" ? "/mo" : ""}
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-zinc-400">
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
            <p className="text-sm text-zinc-400">
              {overLimit.length} user(s) over monitor limit:{" "}
              {overLimit.map((u) => u.email ?? u.id.slice(0, 8)).join(", ")}
            </p>
          )}
          {badChannels.length > 0 && (
            <p className="text-sm text-zinc-400">
              {badChannels.length} channel(s) on a plan that does not include that integration.
            </p>
          )}
        </section>
      )}

      <section className="border border-brand-border rounded-lg p-5 bg-surface/60 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            External health checks
          </h3>
          <button
            type="button"
            onClick={runHealthChecks}
            disabled={running}
            className="text-sm px-4 py-2 rounded-md border border-brand-border hover:bg-bg/40 disabled:opacity-50 text-zinc-300"
          >
            {running ? "Checking…" : "Run checks"}
          </button>
        </div>
        <p className="text-xs text-zinc-500 font-mono break-all">
          Kuma push monitor URL (set in Uptime Kuma, no query string): {KUMA_PUSH_URL}
        </p>
        <p className="text-xs text-zinc-600">
          Checks run from the server (avoids browser CORS blocks on status.upwatch.online).
        </p>
        <ul className="space-y-2">
          {checks.map((c) => (
            <li
              key={c.name}
              className="flex flex-wrap items-center justify-between gap-2 text-sm border border-brand-border/60 rounded-md px-3 py-2"
            >
              <span className="text-zinc-300">{c.name}</span>
              <span
                className={
                  c.status === "ok"
                    ? "text-emerald-400"
                    : c.status === "fail"
                      ? "text-red-400"
                      : c.status === "loading"
                        ? "text-zinc-400"
                        : "text-zinc-500"
                }
              >
                {c.status === "idle"
                  ? "Not run"
                  : c.status === "loading"
                    ? "Checking…"
                    : c.detail || c.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
