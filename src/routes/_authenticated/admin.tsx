import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/NotificationBell";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — UpWatch" },
      { name: "description", content: "Admin console for UpWatch." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

type Plan = "starter" | "pro" | "business";
type Status = "active" | "canceled" | "past_due" | "trialing";

type UserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  role: string;
  plan: Plan;
  status: Status;
  monitors_count: number;
};

type MonitorRow = {
  id: string;
  name: string;
  url: string;
  last_status: string | null;
  last_checked_at: string | null;
  user_id: string;
  is_active: boolean;
  created_at: string;
};

type WaitlistRow = {
  id: string;
  email: string;
  created_at: string;
};

type IncidentRow = {
  id: string;
  monitor_id: string;
  started_at: string;
  resolved_at: string | null;
  error_message: string | null;
};

type ChannelRow = {
  id: string;
  user_id: string;
  type: string;
  target: string;
  is_active: boolean;
  created_at: string;
};

type TicketPriority = "low" | "normal" | "high";
type TicketStatus = "open" | "pending" | "resolved" | "closed";

type TicketRow = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
};

type TicketMessageRow = {
  id: string;
  ticket_id: string;
  author_id: string;
  is_admin: boolean;
  body: string;
  created_at: string;
};

type AdminTab = "users" | "monitors" | "waitlist" | "incidents" | "channels" | "support";

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [monitors, setMonitors] = useState<MonitorRow[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistRow[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AdminTab>("users");
  const [msg, setMsg] = useState<string | null>(null);

  // Ticket thread state
  const [openTicket, setOpenTicket] = useState<TicketRow | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessageRow[]>([]);
  const [ticketReply, setTicketReply] = useState("");
  const [ticketBusy, setTicketBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ""));
  }, []);

  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [profilesRes, subsRes, rolesRes, monsRes, waitRes, incRes, chanRes, ticketsRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, created_at"),
        supabase.from("subscriptions").select("user_id, plan, status"),
        supabase.from("user_roles").select("user_id, role"),
        supabase
          .from("monitors")
          .select("id, name, url, last_status, last_checked_at, user_id, is_active, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("waitlist").select("*").order("created_at", { ascending: false }),
        supabase
          .from("incidents")
          .select("id, monitor_id, started_at, resolved_at, error_message")
          .order("started_at", { ascending: false })
          .limit(100),
        supabase
          .from("notification_channels")
          .select("id, user_id, type, target, is_active, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("support_tickets")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      // Surface the first table that failed rather than silently rendering empty tabs.
      const firstErr =
        profilesRes.error ?? subsRes.error ?? rolesRes.error ?? monsRes.error ??
        waitRes.error ?? incRes.error ?? chanRes.error ?? ticketsRes.error;
      if (firstErr) throw firstErr;

      const profiles = profilesRes.data ?? [];
      const subs = subsRes.data ?? [];
      const roles = rolesRes.data ?? [];
      const mons = monsRes.data ?? [];
      const wait = waitRes.data ?? [];
      const inc = incRes.data ?? [];
      const chans = chanRes.data ?? [];
      const tix = ticketsRes.data ?? [];

      type SubRow = { user_id: string; plan: Plan; status: Status };
      type RoleRow = { user_id: string; role: string };
      const subMap = new Map((subs as SubRow[]).map((s) => [s.user_id, s]));
      const roleMap = new Map((roles as RoleRow[]).map((r) => [r.user_id, r.role]));
      const countMap = new Map<string, number>();
      (mons as MonitorRow[]).forEach((m) =>
        countMap.set(m.user_id, (countMap.get(m.user_id) ?? 0) + 1),
      );

      type ProfileRow = { id: string; display_name: string | null; created_at: string };
      const rows: UserRow[] = (profiles as ProfileRow[]).map((p) => {
        const s = subMap.get(p.id);
        return {
          id: p.id,
          email: null,
          display_name: p.display_name,
          created_at: p.created_at,
          role: roleMap.get(p.id) ?? "user",
          plan: (s?.plan ?? "starter") as Plan,
          status: (s?.status ?? "active") as Status,
          monitors_count: countMap.get(p.id) ?? 0,
        };
      });

      setUsers(rows);
      setMonitors(mons as MonitorRow[]);
      setWaitlist(wait as WaitlistRow[]);
      setIncidents(inc as IncidentRow[]);
      setChannels(chans as ChannelRow[]);
      setTickets(tix as TicketRow[]);
    } catch (err) {
      console.error("admin load failed", err);
      setLoadError(err instanceof Error ? err.message : "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refresh tickets list on any change, and append new messages to
  // an open thread so admins see user replies without reloading.
  useEffect(() => {
    const channel = supabase
      .channel("admin-support")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => load(),
      )
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
  }, [load]);

  async function updatePlan(userId: string, plan: Plan, status: Status) {
    setMsg(null);
    const { error } = await supabase
      .from("subscriptions")
      .upsert({ user_id: userId, plan, status }, { onConflict: "user_id" });

    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg(`Updated plan → ${plan}`);
    load();
  }

  async function toggleAdmin(userId: string, makeAdmin: boolean) {
    setMsg(null);
    if (!makeAdmin && userId === currentUserId) {
      setMsg("You can't revoke your own admin role — ask another admin to do it.");
      return;
    }
    if (makeAdmin) {
      const { error } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: userId, role: "admin" },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      if (error) {
        setMsg(error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) {
        setMsg(error.message);
        return;
      }
    }
    load();
  }

  async function handleSignOut() {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("admin sign out failed", err);
    } finally {
      navigate({ to: "/auth", replace: true });
    }
  }

  async function openTicketThread(t: TicketRow) {
    setOpenTicket(t);
    setTicketMessages([]);
    setTicketReply("");
    try {
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", t.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setTicketMessages((data ?? []) as TicketMessageRow[]);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to load ticket messages.");
    }
  }

  async function updateTicketStatus(id: string, status: TicketStatus) {
    setMsg(null);
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
    if (error) {
      setMsg(error.message);
      return;
    }
    if (openTicket?.id === id) setOpenTicket({ ...openTicket, status });
    load();
  }

  async function sendAdminReply() {
    if (!openTicket || !currentUserId) return;
    const body = ticketReply.trim();
    if (!body) return;
    setTicketBusy(true);
    try {
      const { error } = await supabase.from("support_ticket_messages").insert({
        ticket_id: openTicket.id,
        author_id: currentUserId,
        is_admin: true,
        body,
      });
      if (error) throw error;
      // Auto-move open → pending on first admin reply
      if (openTicket.status === "open") {
        await supabase.from("support_tickets").update({ status: "pending" }).eq("id", openTicket.id);
      }
      setTicketReply("");
      await openTicketThread(openTicket);
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to send reply.");
    } finally {
      setTicketBusy(false);
    }
  }

  const openTicketCount = tickets.filter((t) => t.status === "open" || t.status === "pending").length;

  const totals = {
    users: users.length,
    monitors: monitors.length,
    up: monitors.filter((m) => m.last_status === "up").length,
    down: monitors.filter((m) => m.last_status === "down").length,
    paying: users.filter((u) => u.plan !== "starter" && u.status === "active").length,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-semibold tracking-tight">UpWatch</Link>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Admin</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/" className="text-muted-foreground hover:text-foreground">Home</Link>
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">Dashboard</Link>

            <NotificationBell />
            <button
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Stat label="Users" value={totals.users} />
          <Stat label="Monitors" value={totals.monitors} />
          <Stat label="Up" value={totals.up} accent="text-emerald-400" />
          <Stat label="Down" value={totals.down} accent="text-red-400" />
          <Stat label="Paying" value={totals.paying} accent="text-brand" />
        </section>

        {msg && (
          <div className="text-sm border border-border/60 bg-card/40 rounded-md px-3 py-2">{msg}</div>
        )}

        <div className="flex gap-2 border-b border-border/60 flex-wrap">
          {(["users", "monitors", "waitlist", "incidents", "channels", "support"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t !== "support") setOpenTicket(null); }}
              className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px ${
                tab === t ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
              {t === "support" && openTicketCount > 0 && (
                <span className="ml-2 text-xs bg-brand text-black rounded-full px-2 py-0.5 font-semibold">
                  {openTicketCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : loadError ? (
          <div className="border border-red-900/50 bg-red-950/30 rounded-md p-4 text-sm text-red-300">
            <div className="font-semibold text-red-200 mb-1">Couldn't load admin data</div>
            <div className="mb-3">{loadError}</div>
            <button
              onClick={() => load()}
              className="text-xs px-3 py-1.5 border border-red-800 rounded hover:bg-red-900/40"
            >
              Retry
            </button>
          </div>
        ) : tab === "users" ? (
          <div className="overflow-x-auto border border-border/60 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-card/40 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Plan</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Monitors</th>
                  <th className="text-left px-4 py-3">Joined</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border/60">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.display_name || "—"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={u.role === "admin" ? "text-brand" : "text-muted-foreground"}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.plan}
                        onChange={(e) => updatePlan(u.id, e.target.value as Plan, u.status)}
                        className="bg-background border border-border/60 rounded px-2 py-1 text-sm"
                      >
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="business">Business</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.status}
                        onChange={(e) => updatePlan(u.id, u.plan, e.target.value as Status)}
                        className="bg-background border border-border/60 rounded px-2 py-1 text-sm"
                      >
                        <option value="active">active</option>
                        <option value="trialing">trialing</option>
                        <option value="past_due">past_due</option>
                        <option value="canceled">canceled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">{u.monitors_count}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleAdmin(u.id, u.role !== "admin")}
                        disabled={u.role === "admin" && u.id === currentUserId}
                        title={u.role === "admin" && u.id === currentUserId ? "You can't revoke your own admin role" : ""}
                        className="text-xs px-2 py-1 border border-border/60 rounded hover:border-brand disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {u.role === "admin" ? "Revoke admin" : "Make admin"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "monitors" ? (
          <div className="overflow-x-auto border border-border/60 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-card/40 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">URL</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Last Check</th>
                  <th className="text-left px-4 py-3">Owner</th>
                </tr>
              </thead>
              <tbody>
                {monitors.map((m) => (
                  <tr key={m.id} className="border-t border-border/60">
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-xs">{m.url}</td>
                    <td className="px-4 py-3">
                      <span className={
                        m.last_status === "up" ? "text-emerald-400" :
                        m.last_status === "down" ? "text-red-400" :
                        "text-muted-foreground"
                      }>{m.last_status ?? "pending"}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {m.last_checked_at ? new Date(m.last_checked_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.user_id.slice(0, 8)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "waitlist" ? (
          <div className="overflow-x-auto border border-border/60 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-card/40 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Signed up</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.map((w) => (
                  <tr key={w.id} className="border-t border-border/60">
                    <td className="px-4 py-3">{w.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(w.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {waitlist.length === 0 && (
                  <tr><td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">No signups yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : tab === "incidents" ? (
          (() => {
            // Build id→monitor once so the incidents render is O(N) instead of O(N×M).
            const monitorById = new Map(monitors.map((m) => [m.id, m]));
            return (
          <div className="overflow-x-auto border border-border/60 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-card/40 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Monitor</th>
                  <th className="text-left px-4 py-3">Started</th>
                  <th className="text-left px-4 py-3">Resolved</th>
                  <th className="text-left px-4 py-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((i) => {
                  const mon = monitorById.get(i.monitor_id);
                  return (
                    <tr key={i.id} className="border-t border-border/60">
                      <td className="px-4 py-3">{mon?.name ?? i.monitor_id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(i.started_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs">
                        {i.resolved_at ? (
                          <span className="text-emerald-400">{new Date(i.resolved_at).toLocaleString()}</span>
                        ) : (
                          <span className="text-red-400">Ongoing</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-md">{i.error_message ?? "—"}</td>
                    </tr>
                  );
                })}
                {incidents.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No incidents</td></tr>
                )}
              </tbody>
            </table>
          </div>
            );
          })()
        ) : tab === "channels" ? (
          (() => {
            const userById = new Map(users.map((u) => [u.id, u]));
            return (
              <div className="overflow-x-auto border border-border/60 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-card/40 text-xs uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3">Owner</th>
                      <th className="text-left px-4 py-3">Type</th>
                      <th className="text-left px-4 py-3">Target</th>
                      <th className="text-left px-4 py-3">Active</th>
                      <th className="text-left px-4 py-3">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((c) => {
                      const owner = userById.get(c.user_id);
                      return (
                        <tr key={c.id} className="border-t border-border/60">
                          <td className="px-4 py-3">
                            <div>{owner?.display_name || "—"}</div>
                            <div className="text-xs font-mono text-muted-foreground">{c.user_id.slice(0, 8)}…</div>
                          </td>
                          <td className="px-4 py-3 capitalize">{c.type}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-xs">{c.target}</td>
                          <td className="px-4 py-3">
                            <span className={c.is_active ? "text-emerald-400" : "text-muted-foreground"}>
                              {c.is_active ? "yes" : "no"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(c.created_at).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {channels.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No notification channels</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()
        ) : (
          // Support tab
          (() => {
            const userById = new Map(users.map((u) => [u.id, u]));
            if (openTicket) {
              const owner = userById.get(openTicket.user_id);
              return (
                <div className="border border-border/60 rounded-lg p-6 space-y-5 bg-card/20">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                        {new Date(openTicket.created_at).toLocaleString()} · {openTicket.priority} priority · from {owner?.display_name || openTicket.user_id.slice(0, 8)}
                      </div>
                      <h2 className="text-xl font-semibold">{openTicket.subject}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={openTicket.status}
                        onChange={(e) => updateTicketStatus(openTicket.id, e.target.value as TicketStatus)}
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
                    <TicketBubble mine={false} label={owner?.display_name || "User"} body={openTicket.message} at={openTicket.created_at} />
                    {ticketMessages.map((m) => (
                      <TicketBubble
                        key={m.id}
                        mine={m.is_admin}
                        label={m.is_admin ? "Admin" : owner?.display_name || "User"}
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
                    {tickets.map((t) => {
                      const owner = userById.get(t.user_id);
                      return (
                        <tr key={t.id} className="border-t border-border/60">
                          <td className="px-4 py-3 max-w-sm truncate">{t.subject}</td>
                          <td className="px-4 py-3">
                            <div>{owner?.display_name || "—"}</div>
                            <div className="text-xs font-mono text-muted-foreground">{t.user_id.slice(0, 8)}…</div>
                          </td>
                          <td className="px-4 py-3 capitalize">{t.priority}</td>
                          <td className="px-4 py-3">
                            <select
                              value={t.status}
                              onChange={(e) => updateTicketStatus(t.id, e.target.value as TicketStatus)}
                              className="bg-background border border-border/60 rounded px-2 py-1 text-xs"
                            >
                              <option value="open">open</option>
                              <option value="pending">pending</option>
                              <option value="resolved">resolved</option>
                              <option value="closed">closed</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(t.created_at).toLocaleString()}</td>
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
                    {tickets.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No tickets</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()
        )}
      </main>
    </div>
  );
}

function TicketBubble({ mine, label, body, at }: { mine: boolean; label: string; body: string; at: string }) {
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

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="border border-border/60 rounded-lg px-4 py-3 bg-card/40">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
