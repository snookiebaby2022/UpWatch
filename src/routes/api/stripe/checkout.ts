import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/auth-server";
import { createCheckoutSession, stripePriceId, stripeSecretKey } from "@/lib/stripe.server";

export const Route = createFileRoute("/api/stripe/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!stripeSecretKey()) {
          return json({ error: "billing not configured" }, 503);
        }

        const auth = await requireUser(request);
        if ("error" in auth) return auth.error;
        const { supabaseAdmin, user } = auth;

        let body: { plan?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }

        const plan = body.plan === "business" ? "business" : body.plan === "pro" ? "pro" : null;
        if (!plan) return json({ error: "plan must be pro or business" }, 400);
        if (!stripePriceId(plan)) {
          return json({ error: `price not configured for ${plan}` }, 503);
        }

        const { data: subRow } = await supabaseAdmin
          .from("subscriptions")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle();

        const session = await createCheckoutSession({
          userId: user.id,
          email: user.email ?? "",
          plan,
          customerId: subRow?.stripe_customer_id,
        });

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
