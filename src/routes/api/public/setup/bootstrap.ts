import { createFileRoute } from "@tanstack/react-router";

const OWNER_EMAIL = "snookiebaby2022@gmail.com";
const SETUP_TOKEN = process.env.SETUP_TOKEN ?? "upwatch-fix-2026";

export const Route = createFileRoute("/api/public/setup/bootstrap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token =
          request.headers.get("x-setup-token")
          ?? new URL(request.url).searchParams.get("token");
        if (!token || token !== SETUP_TOKEN) {
          return json({ error: "unauthorized" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const password = process.env.SETUP_PASSWORD ?? "UpWatch2026!Admin";

        let userId: string | null = null;
        let created = false;

        const { data: existingUsers, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        if (listErr) {
          return json({ error: "admin listUsers failed", detail: listErr.message }, 500);
        }

        const existing = existingUsers.users.find(
          (u) => u.email?.toLowerCase() === OWNER_EMAIL.toLowerCase(),
        );

        if (existing) {
          userId = existing.id;
          const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
          });
          if (updateErr) {
            return json({ error: "password update failed", detail: updateErr.message }, 500);
          }
        } else {
          const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: OWNER_EMAIL,
            password,
            email_confirm: true,
            user_metadata: { display_name: "Admin" },
          });
          if (createErr) {
            return json({ error: "createUser failed", detail: createErr.message }, 500);
          }
          userId = createdUser.user?.id ?? null;
          created = true;
        }

        if (!userId) {
          return json({ error: "no user id" }, 500);
        }

        await supabaseAdmin.from("profiles").upsert({
          id: userId,
          display_name: "Admin",
        });

        await supabaseAdmin.from("subscriptions").upsert({
          user_id: userId,
          plan: "business",
          status: "active",
        });

        const { error: roleErr } = await supabaseAdmin.from("user_roles").upsert(
          { user_id: userId, role: "admin" as const },
          { onConflict: "user_id,role" },
        );
        if (roleErr) {
          return json({
            error: "admin role insert failed — run supabase/fix-admin-now.sql in Supabase SQL editor first",
            detail: roleErr.message,
          }, 500);
        }

        return json({
          ok: true,
          created,
          email: OWNER_EMAIL,
          password,
          userId,
          message: "Sign in at /auth with this email and password, then open /admin",
        });
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
