import { createFileRoute } from "@tanstack/react-router";

async function sendAlert(opts: {
  monitor: { id: string; url: string; user_id: string; name?: string };
  transition: "down" | "up";
  errorMessage: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

  await Promise.allSettled(
    channels.map(async (c) => {
      try {
        if (c.type === "slack" || c.type === "discord") {
          await fetch(c.target, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(c.type === "discord" ? { content: text } : { text }),
          });
        } else if (c.type === "webhook") {
          await fetch(c.target, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ monitor: opts.monitor, transition: opts.transition, error: opts.errorMessage }),
          });
        }
        // email channel: no managed email domain wired yet — logged as an alert row for now.
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
        const authHeader = request.headers.get("authorization");
        const apikey = request.headers.get("apikey") ?? authHeader?.replace("Bearer ", "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const nowIso = new Date().toISOString();
        const { data: monitors, error } = await supabaseAdmin
          .from("monitors")
          .select("id, url, type, keyword, interval_seconds, last_status, last_checked_at, is_active")
          .eq("is_active", true);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const due = (monitors ?? []).filter((m) => {
          if (!m.last_checked_at) return true;
          const last = new Date(m.last_checked_at).getTime();
          return Date.now() - last >= (m.interval_seconds ?? 300) * 1000;
        });

        const results = await Promise.allSettled(
          due.map(async (m) => {
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
                headers: { "user-agent": "UpWatch-Monitor/1.0" },
              });
              clearTimeout(timer);
              responseTime = Date.now() - started;
              statusCode = res.status;

              if (res.ok) {
                if (m.type === "keyword" && m.keyword) {
                  const body = await res.text();
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

            await supabaseAdmin.from("check_results").insert({
              monitor_id: m.id,
              status,
              response_time_ms: responseTime,
              status_code: statusCode,
              error_message: errorMessage,
            });

            await supabaseAdmin
              .from("monitors")
              .update({ last_status: status, last_checked_at: nowIso })
              .eq("id", m.id);

            return { id: m.id, status, previous: m.last_status };
          }),
        );

        return Response.json({
          ok: true,
          checked: results.length,
          at: nowIso,
        });
      },
    },
  },
});
