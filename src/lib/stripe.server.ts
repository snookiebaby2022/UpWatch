import type { Plan } from "@/lib/plans";

const SITE_URL = process.env.SITE_URL ?? "https://upwatch.online";

export function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

export function stripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
}

export function stripePriceId(plan: "pro" | "business") {
  const key = plan === "pro" ? "STRIPE_PRICE_PRO" : "STRIPE_PRICE_BUSINESS";
  return process.env[key]?.trim() ?? "";
}

export function planFromPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  if (priceId === stripePriceId("pro")) return "pro";
  if (priceId === stripePriceId("business")) return "business";
  return null;
}

export function planFromUnitAmount(amount: number | null | undefined): Plan | null {
  if (amount === 1000) return "pro";
  if (amount === 3000) return "business";
  return null;
}

async function stripeRequest<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const secret = stripeSecretKey();
  if (!secret) throw new Error("STRIPE_SECRET_KEY not configured");

  const body = new URLSearchParams(params);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Stripe API ${res.status}`);
  }
  return data;
}

export async function createCheckoutSession(opts: {
  userId: string;
  email: string;
  plan: "pro" | "business";
  customerId?: string | null;
}) {
  const price = stripePriceId(opts.plan);
  if (!price) throw new Error(`STRIPE_PRICE_${opts.plan.toUpperCase()} not configured`);

  const params: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: `${SITE_URL}/dashboard?billing=success`,
    cancel_url: `${SITE_URL}/dashboard?billing=cancel`,
    client_reference_id: opts.userId,
    "metadata[user_id]": opts.userId,
    "metadata[plan]": opts.plan,
    "subscription_data[metadata][user_id]": opts.userId,
    "subscription_data[metadata][plan]": opts.plan,
  };
  if (opts.customerId) {
    params.customer = opts.customerId;
  } else if (opts.email) {
    params.customer_email = opts.email;
  }

  return stripeRequest<{ url: string; id: string }>("/checkout/sessions", params);
}

export async function createPortalSession(customerId: string) {
  return stripeRequest<{ url: string }>("/billing_portal/sessions", {
    customer: customerId,
    return_url: `${SITE_URL}/dashboard`,
  });
}

/** Verify Stripe webhook signature (v1) using Web Crypto — works on Cloudflare Workers. */
export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  let timestamp = "";
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const [k, v] = part.split("=");
    if (k === "t") timestamp = v;
    if (k === "v1") signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return signatures.some((sig) => timingSafeEqual(sig, expected));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export type StripeSubscriptionPayload = {
  id: string;
  customer: string;
  status: string;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ price?: { id?: string; unit_amount?: number } }> };
};

export function resolvePlanFromSubscription(sub: StripeSubscriptionPayload): Plan {
  const metaPlan = sub.metadata?.plan;
  if (metaPlan === "pro" || metaPlan === "business") return metaPlan;

  const priceId = sub.items?.data?.[0]?.price?.id;
  const fromPrice = planFromPriceId(priceId);
  if (fromPrice) return fromPrice;

  const amount = sub.items?.data?.[0]?.price?.unit_amount;
  const fromAmount = planFromUnitAmount(amount);
  if (fromAmount) return fromAmount;

  return "starter";
}

export function mapSubscriptionStatus(stripeStatus: string): string {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  if (stripeStatus === "canceled" || stripeStatus === "unpaid") return "canceled";
  if (stripeStatus === "past_due") return "past_due";
  return stripeStatus;
}
