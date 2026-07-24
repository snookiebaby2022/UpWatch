export type Plan = "starter" | "pro" | "business";

/** Monitor count caps — must match pricing page copy. */
export const PLAN_LIMITS: Record<Plan, number> = {
  starter: 5,
  pro: 50,
  business: Infinity,
};

/** Check interval in seconds — enforced by the cron runner, not stored values. */
export const PLAN_INTERVAL_SECONDS: Record<Plan, number> = {
  starter: 900, // 15 minutes
  pro: 300, // 5 minutes
  business: 60, // 1 minute, multi-region in runner
};

export const PLAN_LABEL: Record<Plan, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

/** Notification channel types allowed per plan — must match pricing page. */
export const PLAN_CHANNELS: Record<Plan, readonly string[]> = {
  starter: ["email"],
  pro: ["email", "slack", "discord", "telegram", "webhook"],
  business: ["email", "slack", "discord", "telegram", "webhook"],
};

export function planAllowsChannel(plan: Plan, channelType: string): boolean {
  return PLAN_CHANNELS[plan].includes(channelType);
}
