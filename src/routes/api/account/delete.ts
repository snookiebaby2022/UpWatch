import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/auth-server";
import { cancelSubscription, stripeSecretKey } from "@/lib/stripe.server";

export const Route = createFileRoute("/api/account/delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireUser(request);
        if ("error" in auth) return auth.error;
        const { supabaseAdmin, user } = auth;

        let body: { confirm?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }

        if (body.confirm !== "DELETE") {
          return json({ error: 'Send { "confirm": "DELETE" } to permanently delete your account.' }, 400);
        }

        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("stripe_subscription_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (sub?.stripe_subscription_id && stripeSecretKey()) {
          try {
            await cancelSubscription(sub.stripe_subscription_id);
          } catch (err) {
            console.error("[account/delete] stripe cancel failed", err);
            return json(
              {
                error:
                  "Could not cancel your Stripe subscription. Open the billing portal to cancel first, then delete your account.",
              },
              502,
            );
          }
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (error) {
          return json({ error: error.message }, 500);
        }

        return json({ ok: true });
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
