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
import type { AdminTab, TicketPriority, TicketStatus } from "@/components/admin/types";
import { useAdminData } from "@/components/admin/useAdminData";
import { resolveAdminAccess } from "@/lib/admin-access";
import { completeAuthFromUrl } from "@/lib/auth-oauth";
import { BUILD_LABEL } from "@/lib/build";
import { useUnreadNotificationCount } from "@/hooks/use-unread-notification-count";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — UpWatch" },
      { name: "description", content: "Admin console for UpWatch." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      await completeAuthFromUrl();
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { isAdmin, roleCheckFailed } = await resolveAdminAccess(userData.user.id);
    if (roleCheckFailed) throw redirect({ to: "/dashboard" });
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
  const [ticketStatusFilter, setTicketStatusFilter] = useState<TicketStatus | "all">("open");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<TicketPriority | "all">("all");

  const admin = useAdminData();
  const unreadNotifications = useUnreadNotificationCount();

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
    <div className="admin-console min-h-screen bg-bg text-zinc-100 font-sans">
      <header className="border-b border-brand-border/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="font-semibold tracking-tight text-white">
              UpWatch
            </Link>
            <span className="text-xs uppercase tracking-widest text-zinc-500">
              Admin Console v2
            </span>
            <span className="text-xs font-mono text-zinc-600">build {BUILD_LABEL}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/dashboard" className="text-zinc-400 hover:text-white transition-colors">
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => setTab("support")}
              className={`text-zinc-400 hover:text-white transition-colors ${
                tab === "support" ? "text-brand font-semibold" : ""
              }`}
            >
              Support
              {unreadNotifications > 0 && (
                <span className="ml-1.5 text-xs bg-brand text-black rounded-full px-1.5 py-0.5 font-semibold">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>
            <button
              onClick={() => admin.load()}
              disabled={admin.loading}
              className="text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
            >
              {admin.loading ? "Refreshing…" : "Refresh"}
            </button>
            <NotificationBell />
            <button onClick={handleSignOut} className="text-zinc-400 hover:text-white transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {admin.msg && (
          <div className="text-sm border border-brand-border bg-surface/60 rounded-md px-3 py-2 text-zinc-300">
            {admin.msg}
          </div>
        )}

        {admin.ticketsError && (
          <div className="border border-amber-900/50 bg-amber-950/30 rounded-md p-4 text-sm text-amber-200">
            <div className="font-semibold mb-1">Support tickets not connected</div>
            <p className="mb-2">{admin.ticketsError}</p>
            <p className="text-xs text-amber-200/80">
              SQL file: <code className="font-mono">supabase/fix-tickets-now.sql</code> — paste in{" "}
              <a
                href="https://supabase.com/dashboard/project/zjijihumvmijnijpkwpz/sql/new"
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                Supabase SQL Editor
              </a>
              , then click Refresh above.
            </p>
          </div>
        )}

        <div className="flex gap-2 border-b border-brand-border/60 flex-wrap">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setSearch("");
              }}
              className={`px-4 py-2 text-sm border-b-2 -mb-px ${
                tab === id
                  ? "border-brand text-white"
                  : "border-transparent text-zinc-500 hover:text-white"
              }`}
            >
              {label}
              {id === "support" && unreadNotifications > 0 && (
                <span className="ml-2 text-xs bg-brand text-black rounded-full px-2 py-0.5 font-semibold">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
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
          <div className="text-sm text-zinc-500">Loading…</div>
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
            ticketsError={admin.ticketsError}
            onOpenSupport={() => setTab("support")}
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
            priorityFilter={ticketPriorityFilter}
            onSearchChange={setSearch}
            onStatusFilterChange={setTicketStatusFilter}
            onPriorityFilterChange={setTicketPriorityFilter}
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
