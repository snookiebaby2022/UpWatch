import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/auth-server";
import { createPortalSession, stripeSecretKey } from "@/lib/stripe.server";

export const Route = createFileRoute("/api/stripe/portal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!stripeSecretKey()) {
          return json({ error: "billing not configured" }, 503);
        }

        const auth = await requireUser(request);
        if ("error" in auth) return auth.error;
        const { supabaseAdmin, user } = auth;

        const { data: subRow } = await supabaseAdmin
          .from("subscriptions")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!subRow?.stripe_customer_id) {
          return json(
            { error: "No billing account yet — upgrade to a paid plan first." },
            400,
          );
        }

        const session = await createPortalSession(subRow.stripe_customer_id);
        return json({ url: session.url });
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
