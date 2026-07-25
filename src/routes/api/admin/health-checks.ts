import { createFileRoute } from "@tanstack/react-router";
import { KUMA_PUBLIC_URL, KUMA_PUSH_URL, STATUS_PAGE_URL } from "@/lib/site";

type CheckResult = { name: string; ok: boolean; detail: string };

const CHECKS = [
  { name: "Kuma status API", url: "https://status.upwatch.online/api/status-page/upwatch" },
  { name: "Kuma push API", url: `${KUMA_PUSH_URL}?status=up&msg=OK&ping=1` },
  { name: "UpWatch status page", url: STATUS_PAGE_URL },
  { name: "Public status (Kuma)", url: KUMA_PUBLIC_URL },
] as const;

export const Route = createFileRoute("/api/admin/health-checks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) {
          return json({ error: "unauthorized" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData.user) {
          return json({ error: "invalid session" }, 401);
        }

        const { data: roleRow } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (!roleRow) {
          return json({ error: "forbidden" }, 403);
        }

        const results: CheckResult[] = await Promise.all(
          CHECKS.map(async (c) => {
            try {
              const res = await fetch(c.url, {
                method: "GET",
                redirect: "follow",
                signal: AbortSignal.timeout(15_000),
              });
              const body = await res.text();
              const pushOk = c.name === "Kuma push API" && body.includes('"ok"');
              return {
                name: c.name,
                ok: res.ok || pushOk,
                detail: pushOk ? 'HTTP 200 · {"ok":true}' : `HTTP ${res.status}`,
              };
            } catch (err) {
              return {
                name: c.name,
                ok: false,
                detail: err instanceof Error ? err.message : "Request failed",
              };
            }
          }),
        );

        return json({ ok: true, checks: results, kumaPushUrl: KUMA_PUSH_URL });
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
