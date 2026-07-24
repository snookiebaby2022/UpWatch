import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import type { TicketMessageRow, TicketRow, TicketStatus, UserRow } from "./types";

function TicketBubble({
  mine,
  label,
  body,
  at,
}: {
  mine: boolean;
  label: string;
  body: string;
  at: string;
}) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
          mine
            ? "bg-brand/10 border border-brand/40 text-foreground"
            : "bg-card/60 border border-border/60 text-foreground"
        }`}
      >
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          {label} · {new Date(at).toLocaleString()}
        </div>
        {body}
      </div>
    </div>
  );
}

export function AdminSupportTab({
  tickets,
  users,
  currentUserId,
  search,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onUpdateStatus,
  onLoadMessages,
  onSendReply,
  onError,
}: {
  tickets: TicketRow[];
  users: UserRow[];
  currentUserId: string;
  search: string;
  statusFilter: TicketStatus | "all";
  onSearchChange: (v: string) => void;
  onStatusFilterChange: (v: TicketStatus | "all") => void;
  onUpdateStatus: (id: string, status: TicketStatus) => Promise<boolean | undefined>;
  onLoadMessages: (ticketId: string) => Promise<TicketMessageRow[]>;
  onSendReply: (ticket: TicketRow, body: string) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const userById = new Map(users.map((u) => [u.id, u]));
  const [openTicket, setOpenTicket] = useState<TicketRow | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessageRow[]>([]);
  const [ticketReply, setTicketReply] = useState("");
  const [ticketBusy, setTicketBusy] = useState(false);

  const q = search.trim().toLowerCase();
  const filtered = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (!q) return true;
    const owner = userById.get(t.user_id);
    return (
      t.subject.toLowerCase().includes(q) ||
      t.message.toLowerCase().includes(q) ||
      owner?.email?.toLowerCase().includes(q) ||
      owner?.display_name?.toLowerCase().includes(q)
    );
  });

  async function openTicketThread(t: TicketRow) {
    setOpenTicket(t);
    setTicketMessages([]);
    setTicketReply("");
    try {
      const messages = await onLoadMessages(t.id);
      setTicketMessages(messages);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load ticket messages.");
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel("admin-support-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_ticket_messages" },
        (payload) => {
          const m = payload.new as TicketMessageRow;
          setOpenTicket((cur) => {
            if (cur && m.ticket_id === cur.id) {
              setTicketMessages((prev) =>
                prev.some((x) => x.id === m.id) ? prev : [...prev, m],
              );
            }
            return cur;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function sendAdminReply() {
    if (!openTicket || !currentUserId) return;
    const body = ticketReply.trim();
    if (!body) return;
    setTicketBusy(true);
    try {
      await onSendReply(openTicket, body);
      setTicketReply("");
      await openTicketThread(openTicket);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to send reply.");
    } finally {
      setTicketBusy(false);
    }
  }

  if (openTicket) {
    const owner = userById.get(openTicket.user_id);
    return (
      <div className="border border-border/60 rounded-lg p-6 space-y-5 bg-card/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              {new Date(openTicket.created_at).toLocaleString()} · {openTicket.priority} priority ·
              from {owner?.email ?? owner?.display_name ?? openTicket.user_id.slice(0, 8)}
            </div>
            <h2 className="text-xl font-semibold">{openTicket.subject}</h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={openTicket.status}
              onChange={async (e) => {
                const status = e.target.value as TicketStatus;
                await onUpdateStatus(openTicket.id, status);
                setOpenTicket({ ...openTicket, status });
              }}
              className="bg-background border border-border/60 rounded px-2 py-1 text-sm"
            >
              <option value="open">open</option>
              <option value="pending">pending</option>
              <option value="resolved">resolved</option>
              <option value="closed">closed</option>
            </select>
            <button
              onClick={() => setOpenTicket(null)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <TicketBubble
            mine={false}
            label={owner?.display_name || owner?.email || "User"}
            body={openTicket.message}
            at={openTicket.created_at}
          />
          {ticketMessages.map((m) => (
            <TicketBubble
              key={m.id}
              mine={m.is_admin}
              label={m.is_admin ? "Admin" : owner?.display_name || owner?.email || "User"}
              body={m.body}
              at={m.created_at}
            />
          ))}
        </div>

        <div className="space-y-3">
          <textarea
            value={ticketReply}
            onChange={(e) => setTicketReply(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Reply as admin…"
            className="w-full bg-background border border-border/60 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand"
          />
          <button
            onClick={sendAdminReply}
            disabled={ticketBusy || !ticketReply.trim()}
            className="bg-brand text-black font-semibold px-5 py-2 rounded-full text-sm disabled:opacity-40"
          >
            {ticketBusy ? "Sending…" : "Send reply"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search tickets by subject, user…"
          className="max-w-md bg-background"
        />
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as TicketStatus | "all")}
          className="bg-background border border-border/60 rounded px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div className="overflow-x-auto border border-border/60 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Subject</th>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Priority</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Opened</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const owner = userById.get(t.user_id);
              return (
                <tr key={t.id} className="border-t border-border/60">
                  <td className="px-4 py-3 max-w-sm truncate">{t.subject}</td>
                  <td className="px-4 py-3">
                    <div>{owner?.email ?? owner?.display_name ?? "—"}</div>
                    <div className="text-xs font-mono text-muted-foreground">{t.user_id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{t.priority}</td>
                  <td className="px-4 py-3">
                    <select
                      value={t.status}
                      onChange={(e) => onUpdateStatus(t.id, e.target.value as TicketStatus)}
                      className="bg-background border border-border/60 rounded px-2 py-1 text-xs"
                    >
                      <option value="open">open</option>
                      <option value="pending">pending</option>
                      <option value="resolved">resolved</option>
                      <option value="closed">closed</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openTicketThread(t)}
                      className="text-xs px-3 py-1.5 border border-border/60 rounded hover:border-brand"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No tickets match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
