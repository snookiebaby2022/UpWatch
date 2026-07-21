import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// Stripe webhook — verifies signature and updates the subscriptions table.
// Configure this URL in Stripe: https://<your-domain>/api/public/hooks/stripe
// Subscribe to: checkout.session.completed, invoice.paid, customer.subscription.updated, customer.subscription.deleted

const PRICE_TO_PLAN: Record<string, "pro" | "business"> = {
  // Pro price (£10/mo) — payment link 14A5kDeEQb1o61s1a2ebu00
  // Business price (£30/mo) — payment link 5kQ00j7coedA3Tk5qiebu01
  // Map by amount as a fallback below.
};

function planFromAmount(amount: number | null | undefined): "pro" | "business" | null {
  if (!amount) return null;
  if (amount === 1000) return "pro";
  if (amount === 3000) return "business";
  return null;
}

function verify(body: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const signed = `${t}.${body}`;
  const expected = createHmac("sha256", secret).update(signed).digest("hex");
  try {
    const a = Buffer.from(v1, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/hooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });

        const sig = request.headers.get("stripe-signature");
        const body = await request.text();
        if (!sig || !verify(body, sig, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const s = event.data.object as {
                client_reference_id?: string | null;
                customer?: string | null;
                subscription?: string | null;
                customer_email?: string | null;
                amount_total?: number | null;
                metadata?: Record<string, string> | null;
              };
              const userId = s.client_reference_id ?? s.metadata?.user_id;
              const plan = planFromAmount(s.amount_total) ?? "pro";
              if (userId) {
                await supabaseAdmin.from("subscriptions").upsert(
                  {
                    user_id: userId,
                    stripe_customer_id: s.customer ?? null,
                    stripe_subscription_id: s.subscription ?? null,
                    plan,
                    status: "active",
                  },
                  { onConflict: "user_id" },
                );
              }
              break;
            }
            case "invoice.paid": {
              const inv = event.data.object as {
                subscription?: string | null;
                customer?: string | null;
                lines?: { data?: Array<{ amount?: number; period?: { end?: number } }> };
              };
              const line = inv.lines?.data?.[0];
              const plan = planFromAmount(line?.amount);
              const periodEnd = line?.period?.end ? new Date(line.period.end * 1000).toISOString() : null;
              if (inv.subscription) {
                await supabaseAdmin
                  .from("subscriptions")
                  .update({
                    status: "active",
                    ...(plan ? { plan } : {}),
                    ...(periodEnd ? { current_period_end: periodEnd } : {}),
                  })
                  .eq("stripe_subscription_id", inv.subscription);
              }
              break;
            }
            case "customer.subscription.updated": {
              const sub = event.data.object as {
                id: string;
                status: string;
                current_period_end?: number;
                items?: { data?: Array<{ price?: { unit_amount?: number } }> };
              };
              const amount = sub.items?.data?.[0]?.price?.unit_amount;
              const plan = planFromAmount(amount);
              await supabaseAdmin
                .from("subscriptions")
                .update({
                  status: sub.status,
                  ...(plan ? { plan } : {}),
                  ...(sub.current_period_end
                    ? { current_period_end: new Date(sub.current_period_end * 1000).toISOString() }
                    : {}),
                })
                .eq("stripe_subscription_id", sub.id);
              break;
            }
            case "customer.subscription.deleted": {
              const sub = event.data.object as { id: string };
              await supabaseAdmin
                .from("subscriptions")
                .update({ status: "canceled", plan: "starter" })
                .eq("stripe_subscription_id", sub.id);
              break;
            }
          }
        } catch (err) {
          console.error("stripe webhook error", err);
          return new Response("handler error", { status: 500 });
        }

        return Response.json({ received: true });
      },
    },
  },
});
