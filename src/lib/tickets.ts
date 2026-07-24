import type { TicketPriority } from "@/components/admin/types";

export const PLAN_TICKET_PRIORITY: Record<"starter" | "pro" | "business", TicketPriority> = {
  starter: "low",
  pro: "normal",
  business: "high",
};

const PRIORITY_RANK: Record<TicketPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

export function ticketPriorityRank(priority: TicketPriority) {
  return PRIORITY_RANK[priority];
}

export function sortTicketsByPriority<T extends { priority: TicketPriority; created_at: string; status?: string }>(
  tickets: T[],
) {
  return [...tickets].sort((a, b) => {
    const pa = ticketPriorityRank(a.priority);
    const pb = ticketPriorityRank(b.priority);
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function priorityBadgeClass(priority: TicketPriority) {
  switch (priority) {
    case "high":
      return "text-red-400 bg-red-950/40 border-red-900/50";
    case "normal":
      return "text-amber-300 bg-amber-950/30 border-amber-900/40";
    case "low":
      return "text-zinc-400 bg-zinc-900/40 border-zinc-700/50";
  }
}
