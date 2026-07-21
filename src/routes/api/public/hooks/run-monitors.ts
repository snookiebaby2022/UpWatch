import { createFileRoute } from "@tanstack/react-router";

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
