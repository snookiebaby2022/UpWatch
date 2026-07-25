import { createFileRoute } from "@tanstack/react-router";
import {
  stripeSecretKey,
  stripeWebhookSecret,
  verifyStripeSignature,
  type StripeSubscriptionPayload,
} from "@/lib/stripe.server";
import {
  syncFromCheckoutSession,
  syncFromStripeSubscription,
  upsertSubscriptionFromStripe,
} from "@/lib/subscription-sync.server";

export const Route = createFileRoute("/api/public/hooks/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = stripeWebhookSecret();
        if (!webhookSecret) {
          return json({ error: "webhook not configured" }, 503);
        }

        const payload = await request.text();
        const signature = request.headers.get("stripe-signature");
        const valid = await verifyStripeSignature(payload, signature, webhookSecret);
        if (!valid) {
          return json({ error: "invalid signature" }, 400);
        }

        let event: { type: string; data: { object: Record<string, unknown> } };
        try {
          event = JSON.parse(payload);
        } catch {
          return json({ error: "invalid json" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          switch (event.type) {
            case "checkout.session.completed":
              await syncFromCheckoutSession(
                supabaseAdmin,
                event.data.object as Parameters<typeof syncFromCheckoutSession>[1],
                fetchSubscription,
              );
              break;

            case "customer.subscription.created":
            case "customer.subscription.updated":
              await syncFromStripeSubscription(
                supabaseAdmin,
                event.data.object as StripeSubscriptionPayload,
              );
              break;

            case "customer.subscription.deleted": {
              const sub = event.data.object as StripeSubscriptionPayload;
              const userId =
                sub.metadata?.user_id ??
                (
                  await supabaseAdmin
                    .from("subscriptions")
                    .select("user_id")
                    .eq("stripe_subscription_id", sub.id)
                    .maybeSingle()
                ).data?.user_id;
              if (userId) {
                await upsertSubscriptionFromStripe(supabaseAdmin, {
                  userId,
                  stripeCustomerId: sub.customer,
                  stripeSubscriptionId: null,
                  plan: "starter",
                  status: "canceled",
                });
              }
              break;
            }

            default:
              break;
          }
        } catch (err) {
          console.error("[stripe-webhook]", event.type, err);
          return json(
            { error: err instanceof Error ? err.message : "handler failed" },
            500,
          );
        }

        return json({ received: true });
      },
    },
  },
});

async function fetchSubscription(id: string): Promise<StripeSubscriptionPayload> {
  const secret = stripeSecretKey();
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${id}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const data = (await res.json()) as StripeSubscriptionPayload & {
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe ${res.status}`);
  return data;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
