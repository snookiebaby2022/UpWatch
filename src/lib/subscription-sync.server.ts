import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "@/lib/plans";
import {
  mapSubscriptionStatus,
  resolvePlanFromSubscription,
  type StripeSubscriptionPayload,
} from "@/lib/stripe.server";

export async function findUserIdByEmail(
  supabaseAdmin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match.id;
    if (data.users.length < 200) break;
    page++;
  }
  return null;
}

export async function upsertSubscriptionFromStripe(
  supabaseAdmin: SupabaseClient,
  opts: {
    userId: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    plan?: Plan;
    status?: string;
    currentPeriodEnd?: number | null;
  },
) {
  const row = {
    user_id: opts.userId,
    stripe_customer_id: opts.stripeCustomerId ?? null,
    stripe_subscription_id: opts.stripeSubscriptionId ?? null,
    plan: opts.plan ?? "starter",
    status: opts.status ?? "active",
    current_period_end: opts.currentPeriodEnd
      ? new Date(opts.currentPeriodEnd * 1000).toISOString()
      : null,
  };

  const { error } = await supabaseAdmin.from("subscriptions").upsert(row, {
    onConflict: "user_id",
  });
  if (error) throw error;
}

export async function syncFromStripeSubscription(
  supabaseAdmin: SupabaseClient,
  sub: StripeSubscriptionPayload,
  fallbackUserId?: string | null,
) {
  const userId =
    fallbackUserId ??
    sub.metadata?.user_id ??
    (await findUserIdByCustomer(supabaseAdmin, sub.customer));
  if (!userId) {
    throw new Error(`No user for Stripe subscription ${sub.id}`);
  }

  const plan = resolvePlanFromSubscription(sub);
  const status = mapSubscriptionStatus(sub.status);
  const effectivePlan =
    status === "active" || status === "trialing" ? plan : ("starter" as Plan);

  await upsertSubscriptionFromStripe(supabaseAdmin, {
    userId,
    stripeCustomerId: sub.customer,
    stripeSubscriptionId: sub.id,
    plan: effectivePlan,
    status,
    currentPeriodEnd: sub.current_period_end ?? null,
  });

  return userId;
}

async function findUserIdByCustomer(
  supabaseAdmin: SupabaseClient,
  customerId: string,
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

export async function syncFromCheckoutSession(
  supabaseAdmin: SupabaseClient,
  session: {
    client_reference_id?: string | null;
    metadata?: Record<string, string>;
    customer?: string | null;
    subscription?: string | null;
    customer_details?: { email?: string | null };
    customer_email?: string | null;
  },
  fetchSubscription: (id: string) => Promise<StripeSubscriptionPayload>,
) {
  let userId =
    session.client_reference_id ??
    session.metadata?.user_id ??
    null;

  if (!userId) {
    const email = session.customer_details?.email ?? session.customer_email;
    if (email) userId = await findUserIdByEmail(supabaseAdmin, email);
  }
  if (!userId) {
    throw new Error("checkout session missing user reference");
  }

  if (session.subscription) {
    const sub = await fetchSubscription(session.subscription);
    await syncFromStripeSubscription(supabaseAdmin, sub, userId);
    return userId;
  }

  await upsertSubscriptionFromStripe(supabaseAdmin, {
    userId,
    stripeCustomerId: session.customer ?? null,
    plan: (session.metadata?.plan as Plan) ?? "pro",
    status: "active",
  });
  return userId;
}
