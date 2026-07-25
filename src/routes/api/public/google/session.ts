import { createFileRoute } from "@tanstack/react-router";
import { verifyGoogleIdToken } from "@/lib/verify-google-id-token";

export const Route = createFileRoute("/api/public/google/session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { id_token?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const idToken = body.id_token?.trim();
        if (!idToken) {
          return json({ error: "Missing id_token" }, 400);
        }

        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const publishableKey =
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!supabaseUrl || !publishableKey) {
          return json({ error: "Auth service is not configured" }, 500);
        }

        try {
          const claims = await verifyGoogleIdToken(idToken);
          const email = claims.email.trim().toLowerCase();

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: {
              full_name: claims.name,
              avatar_url: claims.picture,
            },
            app_metadata: {
              provider: "google",
              providers: ["google"],
            },
          });

          if (createErr && !/already|exists|registered/i.test(createErr.message)) {
            return json({ error: "Could not create account", detail: createErr.message }, 500);
          }

          const userId = created.user?.id;
          if (userId) {
            await supabaseAdmin.from("profiles").upsert({
              id: userId,
              display_name: claims.name ?? null,
            });
          }

          const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email,
          });

          if (linkErr || !linkData?.properties?.hashed_token) {
            return json(
              {
                error: "Could not start session",
                detail: linkErr?.message ?? "No login token returned",
              },
              500,
            );
          }

          const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: publishableKey,
            },
            body: JSON.stringify({
              token_hash: linkData.properties.hashed_token,
              type: "email",
            }),
          });

          const sessionPayload = (await verifyRes.json()) as {
            access_token?: string;
            refresh_token?: string;
            msg?: string;
            message?: string;
            error_description?: string;
          };

          if (!verifyRes.ok || !sessionPayload.access_token || !sessionPayload.refresh_token) {
            return json(
              {
                error: "Could not create session",
                detail:
                  sessionPayload.msg ||
                  sessionPayload.message ||
                  sessionPayload.error_description ||
                  `HTTP ${verifyRes.status}`,
              },
              500,
            );
          }

          return json({
            access_token: sessionPayload.access_token,
            refresh_token: sessionPayload.refresh_token,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Google sign-in failed";
          if (/Missing Supabase environment variable/i.test(message)) {
            return json(
              {
                error: "Google sign-in is not fully configured on the server",
                detail: "Add SUPABASE_SERVICE_ROLE_KEY to the Cloudflare Worker (see DEPLOY.md).",
              },
              503,
            );
          }
          return json({ error: message }, 401);
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
