import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/NotificationBell";
import { AdminChannelsTab } from "@/components/admin/AdminChannelsTab";
import { AdminIncidentsTab } from "@/components/admin/AdminIncidentsTab";
import { AdminMonitorsTab } from "@/components/admin/AdminMonitorsTab";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminPlansTab } from "@/components/admin/AdminPlansTab";
import { AdminSupportTab } from "@/components/admin/AdminSupportTab";
import { AdminSystemTab } from "@/components/admin/AdminSystemTab";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { AdminWaitlistTab } from "@/components/admin/AdminWaitlistTab";
import type { AdminTab, TicketStatus } from "@/components/admin/types";
import { useAdminData } from "@/components/admin/useAdminData";
import { BUILD_LABEL } from "@/lib/build";

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
    const { data: isAdmin, error } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (error) {
      console.error("admin role check failed — run supabase/setup-complete.sql", error);
      throw redirect({ to: "/dashboard" });
    }
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

const TABS: { id: AdminTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "monitors", label: "Monitors" },
  { id: "plans", label: "Plans" },
  { id: "waitlist", label: "Waitlist" },
  { id: "incidents", label: "Incidents" },
  { id: "channels", label: "Channels" },
  { id: "support", label: "Support" },
  { id: "system", label: "System" },
];

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [search, setSearch] = useState("");
  const [incidentFilter, setIncidentFilter] = useState<"all" | "open" | "resolved">("open");
  const [ticketStatusFilter, setTicketStatusFilter] = useState<TicketStatus | "all">("all");

  const admin = useAdminData();

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-semibold tracking-tight">
              UpWatch
            </Link>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Admin Console v2
            </span>
            <span className="text-xs font-mono text-muted-foreground/80">build {BUILD_LABEL}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              Home
            </Link>
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <button
              onClick={() => admin.load()}
              disabled={admin.loading}
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              {admin.loading ? "Refreshing…" : "Refresh"}
            </button>
            <NotificationBell />
            <button onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {admin.msg && (
          <div className="text-sm border border-border/60 bg-card/40 rounded-md px-3 py-2">
            {admin.msg}
          </div>
        )}

        <div className="flex gap-2 border-b border-border/60 flex-wrap">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setSearch("");
              }}
              className={`px-4 py-2 text-sm border-b-2 -mb-px ${
                tab === id
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {id === "support" && admin.totals.openTickets > 0 && (
                <span className="ml-2 text-xs bg-brand text-black rounded-full px-2 py-0.5 font-semibold">
                  {admin.totals.openTickets}
                </span>
              )}
              {id === "incidents" && admin.totals.openIncidents > 0 && (
                <span className="ml-2 text-xs bg-amber-500/20 text-amber-300 rounded-full px-2 py-0.5 font-semibold">
                  {admin.totals.openIncidents}
                </span>
              )}
            </button>
          ))}
        </div>

        {admin.loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : admin.loadError ? (
          <div className="border border-red-900/50 bg-red-950/30 rounded-md p-4 text-sm text-red-300">
            <div className="font-semibold text-red-200 mb-1">Couldn't load admin data</div>
            <div className="mb-3">{admin.loadError}</div>
            <button
              onClick={() => admin.load()}
              className="text-xs px-3 py-1.5 border border-red-800 rounded hover:bg-red-900/40"
            >
              Retry
            </button>
          </div>
        ) : tab === "overview" ? (
          <AdminOverview
            totals={admin.totals}
            users={admin.users}
            monitors={admin.monitors}
            incidents={admin.incidents}
            tickets={admin.tickets}
          />
        ) : tab === "users" ? (
          <AdminUsersTab
            users={admin.users}
            search={search}
            currentUserId={admin.currentUserId}
            onSearchChange={setSearch}
            onUpdatePlan={admin.updatePlan}
            onToggleAdmin={admin.toggleAdmin}
          />
        ) : tab === "monitors" ? (
          <AdminMonitorsTab
            monitors={admin.monitors}
            users={admin.users}
            search={search}
            onSearchChange={setSearch}
            onToggleActive={admin.toggleMonitorActive}
          />
        ) : tab === "waitlist" ? (
          <AdminWaitlistTab
            waitlist={admin.waitlist}
            search={search}
            onSearchChange={setSearch}
            onDelete={admin.deleteWaitlistEntry}
          />
        ) : tab === "incidents" ? (
          <AdminIncidentsTab
            incidents={admin.incidents}
            monitors={admin.monitors}
            search={search}
            filter={incidentFilter}
            onSearchChange={setSearch}
            onFilterChange={setIncidentFilter}
            onResolve={admin.resolveIncident}
          />
        ) : tab === "channels" ? (
          <AdminChannelsTab
            channels={admin.channels}
            users={admin.users}
            search={search}
            onSearchChange={setSearch}
          />
        ) : tab === "plans" ? (
          <AdminPlansTab users={admin.users} />
        ) : tab === "system" ? (
          <AdminSystemTab users={admin.users} channels={admin.channels} />
        ) : (
          <AdminSupportTab
            tickets={admin.tickets}
            users={admin.users}
            currentUserId={admin.currentUserId}
            search={search}
            statusFilter={ticketStatusFilter}
            onSearchChange={setSearch}
            onStatusFilterChange={setTicketStatusFilter}
            onUpdateStatus={admin.updateTicketStatus}
            onLoadMessages={admin.loadTicketMessages}
            onSendReply={(ticket, body) => admin.sendAdminReply(ticket, body, admin.currentUserId)}
            onError={admin.setMsg}
          />
        )}
      </main>
    </div>
  );
}
