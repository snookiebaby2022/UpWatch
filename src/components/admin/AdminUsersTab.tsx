import { Input } from "@/components/ui/input";
import type { Plan, Status, UserRow } from "./types";

export function AdminUsersTab({
  users,
  search,
  currentUserId,
  onSearchChange,
  onUpdatePlan,
  onToggleAdmin,
}: {
  users: UserRow[];
  search: string;
  currentUserId: string;
  onSearchChange: (v: string) => void;
  onUpdatePlan: (userId: string, plan: Plan, status: Status) => void;
  onToggleAdmin: (userId: string, makeAdmin: boolean) => void;
}) {
  const q = search.trim().toLowerCase();
  const filtered = users.filter((u) => {
    if (!q) return true;
    return (
      u.email?.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      u.role.includes(q) ||
      u.plan.includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search users by email, name, plan, role…"
        className="max-w-md bg-background"
      />
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
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-border/60">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.display_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email ?? "No email"}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{u.id.slice(0, 8)}…</div>
                </td>
                <td className="px-4 py-3">
                  <span className={u.role === "admin" ? "text-brand" : "text-muted-foreground"}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.plan}
                    onChange={(e) => onUpdatePlan(u.id, e.target.value as Plan, u.status)}
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
                    onChange={(e) => onUpdatePlan(u.id, u.plan, e.target.value as Status)}
                    className="bg-background border border-border/60 rounded px-2 py-1 text-sm"
                  >
                    <option value="active">active</option>
                    <option value="trialing">trialing</option>
                    <option value="past_due">past_due</option>
                    <option value="canceled">canceled</option>
                  </select>
                </td>
                <td className="px-4 py-3">{u.monitors_count}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onToggleAdmin(u.id, u.role !== "admin")}
                    disabled={u.role === "admin" && u.id === currentUserId}
                    title={
                      u.role === "admin" && u.id === currentUserId
                        ? "You can't revoke your own admin role"
                        : ""
                    }
                    className="text-xs px-2 py-1 border border-border/60 rounded hover:border-brand disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {u.role === "admin" ? "Revoke admin" : "Make admin"}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No users match your search
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
