export type Plan = "starter" | "pro" | "business";

/** Monitor count caps — enforced in dashboard + admin. */
export const PLAN_LIMITS: Record<Plan, number> = {
  starter: 5,
  pro: 50,
  business: Infinity,
};

/** Check interval in seconds — enforced by the cron runner (`run-monitors`). */
export const PLAN_INTERVAL_SECONDS: Record<Plan, number> = {
  starter: 900, // 15 minutes
  pro: 300, // 5 minutes
  business: 60, // 1 minute (+ multi-region in runner)
};

export const PLAN_LABEL: Record<Plan, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

export const PLAN_PRICE: Record<Plan, string> = {
  starter: "£0",
  pro: "£10",
  business: "£30",
};

/** Marketing copy — single source of truth for pricing pages and admin. */
export const PLAN_FEATURES: Record<Plan, readonly string[]> = {
  starter: ["5 monitors", "15-minute check intervals", "Email alerts"],
  pro: ["50 monitors", "5-minute check intervals", "Slack & Discord integrations"],
  business: ["Unlimited monitors", "1-minute check intervals", "Triple-probe consensus", "Telegram & custom webhooks"],
};

/** Notification channel types allowed per plan. */
export const PLAN_CHANNELS: Record<Plan, readonly string[]> = {
  starter: ["email"],
  pro: ["email", "slack", "discord"],
  business: ["email", "slack", "discord", "telegram", "webhook"],
};

export const PLAN_ORDER: readonly Plan[] = ["starter", "pro", "business"];

export function planAllowsChannel(plan: Plan, channelType: string): boolean {
  return PLAN_CHANNELS[plan].includes(channelType);
}

export function formatPlanInterval(plan: Plan): string {
  const seconds = PLAN_INTERVAL_SECONDS[plan];
  if (seconds >= 3600) return `${seconds / 3600}h`;
  if (seconds >= 60) return `${seconds / 60} min`;
  return `${seconds}s`;
}

export function monitorLimitLabel(plan: Plan): string {
  const limit = PLAN_LIMITS[plan];
  return limit === Infinity ? "Unlimited" : String(limit);
}

export function isOverMonitorLimit(plan: Plan, count: number): boolean {
  const limit = PLAN_LIMITS[plan];
  return limit !== Infinity && count > limit;
}
