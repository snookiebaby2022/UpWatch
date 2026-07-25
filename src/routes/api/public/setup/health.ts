import { createFileRoute } from "@tanstack/react-router";

/** Public health check — confirms Worker Supabase keys work (no side effects). */
export const Route = createFileRoute("/api/public/setup/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
          if (error) {
            return json({ ok: false, error: error.message }, 503);
          }
          const publishable =
            process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          if (!url || !publishable) {
            return json({ ok: false, error: "publishable key not configured" }, 503);
          }
          const health = await fetch(`${url}/auth/v1/health`, {
            headers: { apikey: publishable },
          });
          const body = await health.text();
          if (!health.ok || /invalid api key/i.test(body)) {
            return json({ ok: false, error: "publishable key rejected" }, 503);
          }
          return json({ ok: true });
        } catch (err) {
          return json(
            { ok: false, error: err instanceof Error ? err.message : "health check failed" },
            503,
          );
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
