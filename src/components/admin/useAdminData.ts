import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  AdminTotals,
  ChannelRow,
  IncidentRow,
  MonitorRow,
  Plan,
  Status,
  TicketMessageRow,
  TicketRow,
  UserRow,
  WaitlistRow,
} from "./types";

export function useAdminData() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [monitors, setMonitors] = useState<MonitorRow[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistRow[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ""));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [
        profilesRes,
        subsRes,
        rolesRes,
        emailsRes,
        monsRes,
        waitRes,
        incRes,
        chanRes,
        ticketsRes,
      ] = await Promise.all([
        supabase.from("profiles").select("id, display_name, created_at"),
        supabase.from("subscriptions").select("user_id, plan, status"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.rpc("get_admin_users"),
        supabase
          .from("monitors")
          .select(
            "id, name, url, type, interval_seconds, last_status, last_checked_at, user_id, is_active, is_public, created_at",
          )
          .order("created_at", { ascending: false }),
        supabase.from("waitlist").select("*").order("created_at", { ascending: false }),
        supabase
          .from("incidents")
          .select("id, monitor_id, started_at, resolved_at, error_message")
          .order("started_at", { ascending: false })
          .limit(200),
        supabase
          .from("notification_channels")
          .select("id, user_id, type, target, is_active, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("support_tickets").select("*").order("created_at", { ascending: false }),
      ]);

      const firstErr =
        profilesRes.error ??
        subsRes.error ??
        rolesRes.error ??
        monsRes.error ??
        waitRes.error ??
        incRes.error ??
        chanRes.error ??
        ticketsRes.error;
      if (firstErr) throw firstErr;

      const profiles = profilesRes.data ?? [];
      const subs = subsRes.data ?? [];
      const roles = rolesRes.data ?? [];
      const emails = emailsRes.error ? [] : (emailsRes.data ?? []);
      const mons = monsRes.data ?? [];
      const wait = waitRes.data ?? [];
      const inc = incRes.data ?? [];
      const chans = chanRes.data ?? [];
      const tix = ticketsRes.data ?? [];

      type SubRow = { user_id: string; plan: Plan; status: Status };
      type RoleRow = { user_id: string; role: string };
      type EmailRow = { user_id: string; email: string };

      const subMap = new Map((subs as SubRow[]).map((s) => [s.user_id, s]));
      const roleMap = new Map((roles as RoleRow[]).map((r) => [r.user_id, r.role]));
      const emailMap = new Map((emails as EmailRow[]).map((e) => [e.user_id, e.email]));
      const countMap = new Map<string, number>();
      (mons as MonitorRow[]).forEach((m) =>
        countMap.set(m.user_id, (countMap.get(m.user_id) ?? 0) + 1),
      );

      type ProfileRow = { id: string; display_name: string | null; created_at: string };
      const rows: UserRow[] = (profiles as ProfileRow[]).map((p) => {
        const s = subMap.get(p.id);
        return {
          id: p.id,
          email: emailMap.get(p.id) ?? null,
          display_name: p.display_name,
          created_at: p.created_at,
          role: roleMap.get(p.id) ?? "user",
          plan: (s?.plan ?? "starter") as Plan,
          status: (s?.status ?? "active") as Status,
          monitors_count: countMap.get(p.id) ?? 0,
        };
      });

      rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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

  useEffect(() => {
    const channel = supabase
      .channel("admin-support")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () =>
        load(),
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
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
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
    setMsg(makeAdmin ? "Admin role granted." : "Admin role revoked.");
    load();
  }

  async function toggleMonitorActive(monitorId: string, isActive: boolean) {
    setMsg(null);
    const { error } = await supabase.from("monitors").update({ is_active: isActive }).eq("id", monitorId);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg(isActive ? "Monitor enabled." : "Monitor paused.");
    load();
  }

  async function resolveIncident(incidentId: string) {
    setMsg(null);
    const { error } = await supabase
      .from("incidents")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", incidentId);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("Incident resolved.");
    load();
  }

  async function deleteWaitlistEntry(id: string) {
    setMsg(null);
    const { error } = await supabase.from("waitlist").delete().eq("id", id);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("Waitlist entry removed.");
    load();
  }

  async function updateTicketStatus(id: string, status: TicketRow["status"]) {
    setMsg(null);
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
    if (error) {
      setMsg(error.message);
      return;
    }
    load();
    return true;
  }

  async function loadTicketMessages(ticketId: string) {
    const { data, error } = await supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as TicketMessageRow[];
  }

  async function sendAdminReply(ticket: TicketRow, body: string, authorId: string) {
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      author_id: authorId,
      is_admin: true,
      body,
    });
    if (error) throw error;
    if (ticket.status === "open") {
      await supabase.from("support_tickets").update({ status: "pending" }).eq("id", ticket.id);
    }
    load();
  }

  const totals: AdminTotals = {
    users: users.length,
    monitors: monitors.length,
    up: monitors.filter((m) => m.last_status === "up").length,
    down: monitors.filter((m) => m.last_status === "down").length,
    paying: users.filter((u) => u.plan !== "starter" && u.status === "active").length,
    waitlist: waitlist.length,
    openIncidents: incidents.filter((i) => !i.resolved_at).length,
    openTickets: tickets.filter((t) => t.status === "open" || t.status === "pending").length,
    activeChannels: channels.filter((c) => c.is_active).length,
  };

  return {
    currentUserId,
    users,
    monitors,
    waitlist,
    incidents,
    channels,
    tickets,
    loading,
    loadError,
    msg,
    setMsg,
    totals,
    load,
    updatePlan,
    toggleAdmin,
    toggleMonitorActive,
    resolveIncident,
    deleteWaitlistEntry,
    updateTicketStatus,
    loadTicketMessages,
    sendAdminReply,
  };
}
