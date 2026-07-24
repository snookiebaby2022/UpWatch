export type Plan = "starter" | "pro" | "business";
export type Status = "active" | "canceled" | "past_due" | "trialing";
export type AdminTab = "overview" | "users" | "monitors" | "waitlist" | "incidents" | "channels" | "support";
export type TicketPriority = "low" | "normal" | "high";
export type TicketStatus = "open" | "pending" | "resolved" | "closed";

export type UserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  role: string;
  plan: Plan;
  status: Status;
  monitors_count: number;
};

export type MonitorRow = {
  id: string;
  name: string;
  url: string;
  type: string;
  interval_seconds: number;
  last_status: string | null;
  last_checked_at: string | null;
  user_id: string;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
};

export type WaitlistRow = {
  id: string;
  email: string;
  created_at: string;
};

export type IncidentRow = {
  id: string;
  monitor_id: string;
  started_at: string;
  resolved_at: string | null;
  error_message: string | null;
};

export type ChannelRow = {
  id: string;
  user_id: string;
  type: string;
  target: string;
  is_active: boolean;
  created_at: string;
};

export type TicketRow = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
};

export type TicketMessageRow = {
  id: string;
  ticket_id: string;
  author_id: string;
  is_admin: boolean;
  body: string;
  created_at: string;
};

export type AdminTotals = {
  users: number;
  monitors: number;
  up: number;
  down: number;
  paying: number;
  waitlist: number;
  openIncidents: number;
  openTickets: number;
  activeChannels: number;
};
