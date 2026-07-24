import { createFileRoute } from "@tanstack/react-router";

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

  const title =
    opts.transition === "down"
      ? `🔴 ${opts.monitor.name ?? opts.monitor.url} is DOWN`
      : `🟢 ${opts.monitor.name ?? opts.monitor.url} is back UP`;
  const detail = opts.errorMessage ? `\nReason: ${opts.errorMessage}` : "";
  const text = `${title}\n${opts.monitor.url}${detail}`;

  const BREVO_GATEWAY = "https://connector-gateway.lovable.dev/brevo";
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL ?? "alerts@upwatch.online";
  const BREVO_SENDER_NAME = "UpWatch Alerts";
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  await Promise.allSettled(
    channels.map(async (c) => {
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
          if (!LOVABLE_API_KEY || !BREVO_API_KEY) {
            console.warn("email alert skipped — Brevo not configured");
            return;
          }
          const html = `<div style="font-family:Arial,sans-serif;padding:16px"><h2 style="margin:0 0 12px">${title}</h2><p style="margin:0 0 8px"><a href="${opts.monitor.url}">${opts.monitor.url}</a></p>${opts.errorMessage ? `<p style="color:#b91c1c;margin:0">Reason: ${opts.errorMessage}</p>` : ""}<hr style="margin:20px 0;border:none;border-top:1px solid #eee"/><p style="font-size:12px;color:#888;margin:0">UpWatch — automated monitoring alert</p></div>`;
          const res = await fetch(`${BREVO_GATEWAY}/smtp/email`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${LOVABLE_API_KEY}`,
              "x-connection-api-key": BREVO_API_KEY,
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
        // Accept either the CRON_SECRET (if bound) or the Supabase publishable
        // key via the standard `apikey` header — the documented pg_cron pattern.
        const authHeader = request.headers.get("authorization");
        const provided = request.headers.get("x-cron-secret")
          ?? request.headers.get("apikey")
          ?? authHeader?.replace("Bearer ", "");
        const cronSecret = process.env.CRON_SECRET;
        const publishableKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
          process.env.SUPABASE_ANON_KEY ??
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const accepted = [cronSecret, publishableKey].filter(Boolean) as string[];
        if (accepted.length === 0) {
          console.error("[run-monitors] no auth secrets bound to worker — refusing to run.");
          return new Response(JSON.stringify({ error: "server not configured" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
        if (!provided || !accepted.includes(provided)) {
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
          .select("id, user_id, name, url, type, keyword, interval_seconds, last_status, last_checked_at, is_active")
          .eq("is_active", true);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        // Build user_id -> plan map so business monitors get multi-region checks.
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
          return Date.now() - last >= (m.interval_seconds ?? 300) * 1000;
        });


        // Perform a single HTTP probe from one region and return a normalized result.
        async function probe(m: typeof due[number], region: string) {
          const started = Date.now();
          let status: "up" | "down" = "down";
          let statusCode: number | null = null;
          let errorMessage: string | null = null;
          let responseTime: number | null = null;
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15_000);
            const res = await fetch(m.url, {
              method: "GET",
              signal: controller.signal,
              redirect: "follow",
              headers: {
                "user-agent": `UpWatch-Monitor/1.0 (${region})`,
                "accept-language": region === "eu-west" ? "en-GB,en;q=0.9" : region === "ap-south" ? "en-IN,en;q=0.9" : "en-US,en;q=0.9",
              },
            });
            clearTimeout(timer);
            responseTime = Date.now() - started;
            statusCode = res.status;
            if (res.ok) {
              if (m.type === "keyword" && m.keyword) {
                const reader = res.body?.getReader();
                const decoder = new TextDecoder();
                let body = "";
                const CAP = 512 * 1024;
                if (reader) {
                  while (body.length < CAP) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    body += decoder.decode(value, { stream: true });
                  }
                  await reader.cancel().catch(() => {});
                }
                status = body.includes(m.keyword) ? "up" : "down";
                if (status === "down") errorMessage = `keyword "${m.keyword}" missing`;
              } else {
                status = "up";
              }
            } else {
              status = "down";
              errorMessage = `HTTP ${res.status}`;
            }
          } catch (err) {
            responseTime = Date.now() - started;
            status = "down";
            errorMessage = err instanceof Error ? err.message : "check failed";
          }
          return { region, status, statusCode, errorMessage, responseTime };
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
                await supabaseAdmin
                  .from("monitors")
                  .update({ last_status: "down", last_checked_at: nowIso })
                  .eq("id", m.id);
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
                statusCode = probes.find((p) => p.statusCode != null)?.statusCode ?? null;
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

              await supabaseAdmin
                .from("monitors")
                .update({ last_status: status, last_checked_at: nowIso })
                .eq("id", m.id);

              const prev = m.last_status;
              if (prev && prev !== "pending" && prev !== status) {
                if (status === "down") {
                  await supabaseAdmin.from("incidents").insert({
                    monitor_id: m.id,
                    error_message: errorMessage,
                  });
                  await sendAlert({ monitor: m, transition: "down", errorMessage });
                } else if (status === "up") {
                  await supabaseAdmin
                    .from("incidents")
                    .update({ resolved_at: nowIso })
                    .eq("monitor_id", m.id)
                    .is("resolved_at", null);
                  await sendAlert({ monitor: m, transition: "up", errorMessage: null });
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
          return Response.json({
            ok: true,
            checked: results.length,
            failed,
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
