/** Map notification rows from DB (supports both `message` and `body` columns). */
export type NotificationRow = {
  id: string;
  type?: string | null;
  title: string;
  body?: string | null;
  message?: string | null;
  link?: string | null;
  read: boolean;
  created_at: string;
};

export function notificationText(n: NotificationRow): string | null {
  return n.body ?? n.message ?? null;
}

export function notificationLink(n: NotificationRow): string | null {
  if (n.link) return n.link;
  if (n.type === "ticket_reply" || n.title.startsWith("Support replied:")) return "/tickets";
  if (n.type?.startsWith("incident_")) return "/dashboard";
  return null;
}

export function notificationInsertPayload(opts: {
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string;
}): Record<string, string> {
  return {
    user_id: opts.user_id,
    type: opts.type,
    title: opts.title,
    body: opts.body,
    message: opts.body,
    link: opts.link,
  };
}
