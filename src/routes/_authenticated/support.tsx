import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/NotificationBell";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support — UpWatch" },
      { name: "description", content: "Contact UpWatch support and track your tickets." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SupportPage,
});

type Priority = "low" | "normal" | "high";
type Status = "open" | "pending" | "resolved" | "closed";

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  priority: Priority;
  status: Status;
  created_at: string;
  updated_at: string;
};

type TicketMessage = {
  id: string;
  ticket_id: string;
  author_id: string;
  is_admin: boolean;
  body: string;
  created_at: string;
};

type Plan = "starter" | "pro" | "business";

const PLAN_PRIORITY: Record<Plan, Priority> = {
  starter: "low",
  pro: "normal",
  business: "high",
};

function SupportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");
  const [plan, setPlan] = useState<Plan>("starter");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // New-ticket form
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const priority: Priority = PLAN_PRIORITY[plan];
  const [submitting, setSubmitting] = useState(false);

  // Thread view
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? "";
      setUserId(uid);
      if (!uid) return;
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan,status")
        .eq("user_id", uid)
        .maybeSingle();
      const p = (sub?.plan as Plan | undefined) ?? "starter";
      if (p === "starter" || p === "pro" || p === "business") setPlan(p);
    });
  }, []);


  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      setTickets((data ?? []) as Ticket[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refresh list on ticket changes and append admin replies to the
  // currently-open thread so users see responses without reloading.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user-support-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_ticket_messages" },
        (payload) => {
          const m = payload.new as TicketMessage;
          setOpenTicket((cur) => {
            if (cur && m.ticket_id === cur.id) {
              setMessages((prev) =>
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
  }, [userId, load]);

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const s = subject.trim();
    const m = body.trim();
    if (!s || !m) {
      setMsg("Subject and message are required.");
      return;
    }
    if (s.length > 200 || m.length > 5000) {
      setMsg("Subject max 200 chars, message max 5000.");
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      // Priority is derived server-side from the user's active plan by a
      // BEFORE INSERT trigger, so it can't be spoofed from the client.
      const { error: err } = await supabase.from("support_tickets").insert({
        user_id: userId,
        subject: s,
        message: m,
      });
      if (err) throw err;

      setSubject("");
      setBody("");
      setMsg("Ticket submitted. We'll be in touch shortly.");
      load();

    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to submit ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  async function openThread(t: Ticket) {
    setOpenTicket(t);
    setMessages([]);
    setReply("");
    try {
      const { data, error: err } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", t.id)
        .order("created_at", { ascending: true });
      if (err) throw err;
      setMessages((data ?? []) as TicketMessage[]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load messages.");
    }
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!openTicket || !userId) return;
    const b = reply.trim();
    if (!b) return;
    if (b.length > 5000) {
      setMsg("Reply max 5000 chars.");
      return;
    }
    setReplying(true);
    try {
      const { error: err } = await supabase.from("support_ticket_messages").insert({
        ticket_id: openTicket.id,
        author_id: userId,
        is_admin: false,
        body: b,
      });
      if (err) throw err;
      setReply("");
      await openThread(openTicket);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to send reply.");
    } finally {
      setReplying(false);
    }
  }

  async function handleSignOut() {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
    } finally {
      navigate({ to: "/auth", replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-bg text-zinc-300 font-sans">
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-brand animate-pulse" />
          <span className="text-white font-bold tracking-tight text-xl">UpWatch</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-zinc-400 hover:text-white transition-colors">
            Home
          </Link>
          <Link to="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors">
            Dashboard
          </Link>

          <NotificationBell />
          <button
            onClick={handleSignOut}
            className="bg-surface border border-brand-border px-4 py-2 rounded-full text-sm font-semibold text-white hover:bg-brand-border transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3">Support</h1>
          <p className="text-zinc-400">Open a ticket and we'll get back to you. Track all your conversations here.</p>
        </div>

        {msg && (
          <div className="text-sm border border-brand-border bg-surface/60 rounded-md px-4 py-3 text-white">
            {msg}
          </div>
        )}

        {openTicket ? (
          <section className="border border-brand-border rounded-2xl bg-surface/40 p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                  {new Date(openTicket.created_at).toLocaleString()} · {openTicket.priority} priority ·{" "}
                  <span className={statusColor(openTicket.status)}>{openTicket.status}</span>
                </div>
                <h2 className="text-2xl font-bold text-white">{openTicket.subject}</h2>
              </div>
              <button
                onClick={() => setOpenTicket(null)}
                className="text-sm text-zinc-400 hover:text-white"
              >
                ← Back to tickets
              </button>
            </div>

            <div className="space-y-3">
              <MessageBubble mine body={openTicket.message} at={openTicket.created_at} />
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  mine={!m.is_admin}
                  admin={m.is_admin}
                  body={m.body}
                  at={m.created_at}
                />
              ))}
            </div>

            {openTicket.status === "closed" ? (
              <div className="text-sm text-zinc-500 italic">This ticket is closed.</div>
            ) : (
              <form onSubmit={submitReply} className="space-y-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                  maxLength={5000}
                  placeholder="Add a reply…"
                  className="w-full bg-bg border border-brand-border rounded-lg px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand"
                />
                <button
                  type="submit"
                  disabled={replying || !reply.trim()}
                  className="bg-brand text-black font-semibold px-5 py-2 rounded-full text-sm disabled:opacity-40"
                >
                  {replying ? "Sending…" : "Send reply"}
                </button>
              </form>
            )}
          </section>
        ) : (
          <>
            <section className="border border-brand-border rounded-2xl bg-surface/40 p-6">
              <h2 className="text-xl font-bold text-white mb-4">New ticket</h2>
              <form onSubmit={submitTicket} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-1">
                    Subject
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={200}
                    required
                    className="w-full bg-bg border border-brand-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand"
                    placeholder="Short summary of the issue"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-1">
                    Priority
                  </label>
                  <div className="flex items-center gap-3 bg-bg border border-brand-border rounded-lg px-4 py-2.5">
                    <span className="text-white capitalize font-medium">{priority}</span>
                    <span className="text-xs text-zinc-500">
                      · set automatically from your <span className="capitalize">{plan}</span> plan
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-1">
                    Message
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    maxLength={5000}
                    required
                    placeholder="Describe what's happening, what you expected, and any relevant URLs."
                    className="w-full bg-bg border border-brand-border rounded-lg px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-brand text-black font-semibold px-6 py-2.5 rounded-full text-sm disabled:opacity-40"
                >
                  {submitting ? "Submitting…" : "Submit ticket"}
                </button>
              </form>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4">Your tickets</h2>
              {loading ? (
                <div className="text-sm text-zinc-500">Loading…</div>
              ) : error ? (
                <div className="text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-md p-4">
                  {error}
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-sm text-zinc-500 border border-brand-border rounded-lg p-6 text-center">
                  No tickets yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {tickets.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => openThread(t)}
                      className="w-full text-left border border-brand-border rounded-lg px-4 py-3 hover:border-brand bg-surface/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-white font-medium truncate">{t.subject}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {new Date(t.created_at).toLocaleString()} · {t.priority} priority
                          </div>
                        </div>
                        <span className={`text-xs uppercase tracking-widest ${statusColor(t.status)}`}>
                          {t.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function statusColor(s: Status) {
  switch (s) {
    case "open":
      return "text-brand";
    case "pending":
      return "text-yellow-400";
    case "resolved":
      return "text-emerald-400";
    case "closed":
      return "text-zinc-500";
  }
}

function MessageBubble({
  mine,
  admin,
  body,
  at,
}: {
  mine: boolean;
  admin?: boolean;
  body: string;
  at: string;
}) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
          mine
            ? "bg-brand/10 border border-brand/30 text-white"
            : "bg-surface border border-brand-border text-zinc-200"
        }`}
      >
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
          {admin ? "UpWatch Support" : mine ? "You" : "Support"} ·{" "}
          {new Date(at).toLocaleString()}
        </div>
        {body}
      </div>
    </div>
  );
}
