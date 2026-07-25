import { createFileRoute } from "@tanstack/react-router";
import {
  legacyIntsForPendingMatch,
  monitorStatusToDb,
  monitorStatusToLegacyInt,
  normalizeMonitorStatus,
  type MonitorStatus,
} from "@/lib/monitor-status";

async function sendAlert(opts: {
  monitor: { id: string; url: string; user_id: string; name?: string };
  transition: "down" | "up";
  errorMessage: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isPublicHttpUrl } = await import("@/lib/url-safety");
  const { data: channels } = await supabaseAdmin
    .from("notification_channels")
    .select("type, target")
    .eq("user_id", opts.monitor.user_id)
    .eq("is_active", true);
  if (!channels?.length) return;

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", opts.monitor.user_id)
    .maybeSingle();
  const plan =
    sub?.status === "active" && sub?.plan ? (sub.plan as import("@/lib/plans").Plan) : "starter";
  const { planAllowsChannel } = await import("@/lib/plans");
  const allowed = channels.filter((c) => planAllowsChannel(plan, c.type));
  if (!allowed.length) return;

  const title =
    opts.transition === "down"
      ? `🔴 ${opts.monitor.name ?? opts.monitor.url} is DOWN`
      : `🟢 ${opts.monitor.name ?? opts.monitor.url} is back UP`;
  const detail = opts.errorMessage ? `\nReason: ${opts.errorMessage}` : "";
  const text = `${title}\n${opts.monitor.url}${detail}`;

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL ?? "alerts@upwatch.online";
  const BREVO_SENDER_NAME = "UpWatch Alerts";
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  await Promise.allSettled(
    allowed.map(async (c) => {
      try {
        if (c.type === "slack" || c.type === "discord" || c.type === "webhook") {
          const safety = isPublicHttpUrl(c.target);
          if (!safety.ok) {
            console.warn("alert target blocked", c.type, safety.reason);
            return;
          }
          if (c.type === "slack") {
            await fetch(c.target, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ text }),
            });
          } else if (c.type === "discord") {
            await fetch(c.target, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ content: text }),
            });
          } else {
            await fetch(c.target, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                monitor: { id: opts.monitor.id, name: opts.monitor.name, url: opts.monitor.url },
                transition: opts.transition,
                error: opts.errorMessage,
              }),
            });
          }
        } else if (c.type === "email") {
          if (!BREVO_API_KEY) {
            console.warn("email alert skipped — BREVO_API_KEY not set");
            return;
          }
          const html = `<div style="font-family:Arial,sans-serif;padding:16px"><h2 style="margin:0 0 12px">${title}</h2><p style="margin:0 0 8px"><a href="${opts.monitor.url}">${opts.monitor.url}</a></p>${opts.errorMessage ? `<p style="color:#b91c1c;margin:0">Reason: ${opts.errorMessage}</p>` : ""}<hr style="margin:20px 0;border:none;border-top:1px solid #eee"/><p style="font-size:12px;color:#888;margin:0">UpWatch — automated monitoring alert</p></div>`;
          const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "api-key": BREVO_API_KEY,
            },
            body: JSON.stringify({
              sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
              to: [{ email: c.target }],
              subject: title,
              htmlContent: html,
              textContent: text,
            }),
          });
          if (!res.ok) {
            console.error("brevo email failed", res.status, await res.text());
          }
        } else if (c.type === "telegram") {
          if (!TELEGRAM_BOT_TOKEN) {
            console.warn("telegram alert skipped — TELEGRAM_BOT_TOKEN not set");
            return;
          }
          const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              chat_id: c.target,
              text,
              disable_web_page_preview: true,
            }),
          });
          if (!res.ok) {
            console.error("telegram send failed", res.status, await res.text());
          }
        }
      } catch (err) {
        console.error("alert dispatch failed", c.type, err);
      }
    }),
  );
}




export const Route = createFileRoute("/api/public/hooks/run-monitors")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
        // Cron auth: accept either the server-only CRON_SECRET (Bearer /
        // x-cron-secret) OR the Supabase publishable key via `apikey` header —
        // the documented pg_cron pattern. The runner is idempotent (next_check_at
        // gate), so the publishable key is acceptable as a caller identifier.
        const authHeader = request.headers.get("authorization");
        const bearer = request.headers.get("x-cron-secret")
          ?? authHeader?.replace("Bearer ", "");
        const apikey = request.headers.get("apikey");
        const cronSecret = process.env.CRON_SECRET;
        const publishable = process.env.SUPABASE_PUBLISHABLE_KEY
          ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const bearerOk = !!cronSecret && !!bearer && bearer === cronSecret;
        const apikeyOk = !!publishable && !!apikey && apikey === publishable;

        if (!bearerOk && !apikeyOk) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }



        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { isPublicHttpUrl } = await import("@/lib/url-safety");

        const nowIso = new Date().toISOString();
        const { data: monitors, error } = await supabaseAdmin
          .from("monitors")
          .select("id, user_id, name, url, type, keyword, last_status, last_checked_at, is_active")
          .eq("is_active", true);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        // Build user_id -> plan map so we can (a) run business monitors in
        // multi-region and (b) enforce the correct check interval from the
        // live plan, not whatever `interval_seconds` was stored at create-time.
        const { PLAN_INTERVAL_SECONDS } = await import("@/lib/plans");
        const PLAN_INTERVAL = PLAN_INTERVAL_SECONDS;
        const userIds = Array.from(new Set((monitors ?? []).map((m) => m.user_id)));
        const planByUser = new Map<string, string>();
        if (userIds.length) {
          const { data: subs } = await supabaseAdmin
            .from("subscriptions")
            .select("user_id, plan, status")
            .in("user_id", userIds)
            .eq("status", "active");
          for (const s of subs ?? []) planByUser.set(s.user_id, s.plan);
        }


        const due = (monitors ?? []).filter((m) => {
          if (!m.last_checked_at) return true;
          const last = new Date(m.last_checked_at).getTime();
          const plan = planByUser.get(m.user_id) ?? "starter";
          const interval = PLAN_INTERVAL[plan] ?? 900;
          return Date.now() - last >= interval * 1000;
        });



        // Perform an HTTP probe with retries for transient 502/503/504/timeouts.
        async function probe(m: typeof due[number], region: string) {
          const { probeHttpWithRetries } = await import("@/lib/monitor-probe");
          const result = await probeHttpWithRetries({
            url: m.url,
            region,
            timeoutMs: 30_000,
            maxAttempts: 3,
            retryDelayMs: 2_000,
            keyword: m.keyword,
            monitorType: m.type,
          });
          return {
            region,
            status: result.status,
            statusCode: result.statusCode,
            errorMessage: result.errorMessage,
            responseTime: result.responseTime,
          };
        }

        // Batch check execution to cap concurrent outbound fetches.
        const CONCURRENCY = 20;
        const REGIONS_BUSINESS = ["us-east", "eu-west", "ap-south"];
        const results: PromiseSettledResult<{ id: string; status: string; previous: string | null }>[] = [];
        for (let i = 0; i < due.length; i += CONCURRENCY) {
          const batch = due.slice(i, i + CONCURRENCY);
          const batchResults = await Promise.allSettled(
            batch.map(async (m) => {
              // SSRF guard — reject private/loopback/metadata targets before any fetch.
              const safety = isPublicHttpUrl(m.url);
              if (!safety.ok) {
                const errorMessage = `URL blocked: ${safety.reason}`;
                await supabaseAdmin.from("check_results").insert({
                  monitor_id: m.id,
                  status: "down",
                  response_time_ms: null,
                  status_code: null,
                  error_message: errorMessage,
                });
                await persistMonitorStatus(supabaseAdmin, m.id, normalizeMonitorStatus(m.last_status), "down", nowIso);
                return { id: m.id, status: "down", previous: m.last_status };
              }

              const plan = planByUser.get(m.user_id) ?? "starter";
              let status: "up" | "down";
              let statusCode: number | null;
              let errorMessage: string | null;
              let responseTime: number | null;

              if (plan === "business") {
                // Multi-region: probe from 3 regions in parallel, majority wins.
                const probes = await Promise.all(REGIONS_BUSINESS.map((r) => probe(m, r)));
                const upCount = probes.filter((p) => p.status === "up").length;
                status = upCount >= 2 ? "up" : "down";
                // Aggregate metrics from probes.
                const rts = probes.map((p) => p.responseTime).filter((n): n is number => n != null);
                responseTime = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null;
                // Representative status code should reflect the consensus, not the first non-null.
                const consensusProbes = probes.filter((p) => p.status === status);
                statusCode = consensusProbes.find((p) => p.statusCode != null)?.statusCode
                  ?? probes.find((p) => p.statusCode != null)?.statusCode
                  ?? null;
                const regionSummary = probes.map((p) => `${p.region}:${p.status}${p.errorMessage ? `(${p.errorMessage})` : ""}`).join(" | ");

                errorMessage = status === "down" ? `multi-region consensus DOWN — ${regionSummary}` : null;
                // Persist an individual row per region for the incident timeline.
                await supabaseAdmin.from("check_results").insert(
                  probes.map((p) => ({
                    monitor_id: m.id,
                    status: p.status,
                    response_time_ms: p.responseTime,
                    status_code: p.statusCode,
                    error_message: p.errorMessage ? `[${p.region}] ${p.errorMessage}` : `[${p.region}] ok`,
                  })),
                );
              } else {
                const p = await probe(m, "primary");
                status = p.status;
                statusCode = p.statusCode;
                errorMessage = p.errorMessage;
                responseTime = p.responseTime;
                await supabaseAdmin.from("check_results").insert({
                  monitor_id: m.id,
                  status,
                  response_time_ms: responseTime,
                  status_code: statusCode,
                  error_message: errorMessage,
                });
              }

              // TOCTOU-safe transition for alerts; persist check outcome (text or legacy int column).
              const prev = normalizeMonitorStatus(m.last_status);
              let weApplied = await persistMonitorStatus(supabaseAdmin, m.id, prev, status, nowIso);

              if (weApplied && prev !== "pending" && prev !== status) {
                if (status === "down") {
                  // Partial unique index (incidents_one_open_per_monitor) makes
                  // duplicate open incidents impossible; ignore the conflict.
                  const { error: incErr } = await supabaseAdmin
                    .from("incidents")
                    .insert({ monitor_id: m.id, error_message: errorMessage });
                  if (!incErr) {
                    await sendAlert({ monitor: m, transition: "down", errorMessage });
                  }
                } else if (status === "up") {
                  const { data: resolved } = await supabaseAdmin
                    .from("incidents")
                    .update({ resolved_at: nowIso })
                    .eq("monitor_id", m.id)
                    .is("resolved_at", null)
                    .select("id");
                  if ((resolved?.length ?? 0) > 0) {
                    await sendAlert({ monitor: m, transition: "up", errorMessage: null });
                  }
                }
              }

              return { id: m.id, status, previous: prev };
            }),
          );

          results.push(...batchResults);
        }




          const failed = results.filter((r) => r.status === "rejected").length;
          if (failed > 0) {
            console.warn(`[run-monitors] ${failed}/${results.length} checks rejected`);
          }

          const { pingKumaPush } = await import("@/lib/kuma-push");
          const kumaPush = await pingKumaPush({
            status: "up",
            msg: `checked ${results.length}`,
            ping: Math.max(1, Math.round(Date.now() % 100_000)),
          });
          if (!kumaPush.ok) {
            console.warn("[run-monitors] kuma push heartbeat failed:", kumaPush.detail);
          }

          return Response.json({
            ok: true,
            checked: results.length,
            failed,
            kumaPush: kumaPush.ok,
            at: nowIso,
          });
        } catch (err) {
          console.error("[run-monitors] handler crashed", err);
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "internal error" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});

async function persistMonitorStatus(
  supabaseAdmin: Awaited<ReturnType<typeof import("@/integrations/supabase/client.server")>>["supabaseAdmin"],
  monitorId: string,
  prev: MonitorStatus,
  status: MonitorStatus,
  nowIso: string,
): Promise<boolean> {
  const payload = { last_status: monitorStatusToDb(status), last_checked_at: nowIso };
  const pendingMatch = legacyIntsForPendingMatch();
  const prevFilter = prev === "pending" ? pendingMatch : [monitorStatusToDb(prev), monitorStatusToLegacyInt(prev)];

  let { data: updatedRows, error } = await supabaseAdmin
    .from("monitors")
    .update(payload)
    .eq("id", monitorId)
    .in("last_status", prevFilter as string[])
    .select("id");

  if (error?.code === "22P02") {
    ({ data: updatedRows, error } = await supabaseAdmin
      .from("monitors")
      .update({ last_status: monitorStatusToLegacyInt(status), last_checked_at: nowIso })
      .eq("id", monitorId)
      .in("last_status", prev === "pending" ? [0] : [monitorStatusToLegacyInt(prev)])
      .select("id"));
  }

  if ((updatedRows?.length ?? 0) > 0) return true;

  let forced = await supabaseAdmin
    .from("monitors")
    .update(payload)
    .eq("id", monitorId)
    .select("id");
  if (forced.error?.code === "22P02") {
    forced = await supabaseAdmin
      .from("monitors")
      .update({ last_status: monitorStatusToLegacyInt(status), last_checked_at: nowIso })
      .eq("id", monitorId)
      .select("id");
  }
  return (forced.data?.length ?? 0) > 0;
}
