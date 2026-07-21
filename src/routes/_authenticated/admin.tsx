import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [monitors, setMonitors] = useState<MonitorRow[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistRow[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "monitors" | "waitlist" | "incidents">("users");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ""));
  }, []);

  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [profilesRes, subsRes, rolesRes, monsRes, waitRes, incRes] = await Promise.all([
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
      ]);

      // Surface the first table that failed rather than silently rendering empty tabs.
      const firstErr =
        profilesRes.error ?? subsRes.error ?? rolesRes.error ?? monsRes.error ?? waitRes.error ?? incRes.error;
      if (firstErr) throw firstErr;

      const profiles = profilesRes.data ?? [];
      const subs = subsRes.data ?? [];
      const roles = rolesRes.data ?? [];
      const mons = monsRes.data ?? [];
      const wait = waitRes.data ?? [];
      const inc = incRes.data ?? [];

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
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">Dashboard</Link>
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

        <div className="flex gap-2 border-b border-border/60">
          {(["users", "monitors", "waitlist", "incidents"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px ${
                tab === t ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
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
        ) : (
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
        )}
      </main>
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
