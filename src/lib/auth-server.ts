import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function requireUser(request: Request): Promise<
  | { supabaseAdmin: SupabaseClient; user: User }
  | { error: Response }
> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { error: json({ error: "unauthorized" }, 401) };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { error: json({ error: "invalid session" }, 401) };
  }

  return { supabaseAdmin, user: data.user };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
