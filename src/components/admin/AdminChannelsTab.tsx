import { Input } from "@/components/ui/input";
import type { ChannelRow, UserRow } from "./types";

export function AdminChannelsTab({
  channels,
  users,
  search,
  onSearchChange,
}: {
  channels: ChannelRow[];
  users: UserRow[];
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const userById = new Map(users.map((u) => [u.id, u]));
  const q = search.trim().toLowerCase();
  const filtered = channels.filter((c) => {
    if (!q) return true;
    const owner = userById.get(c.user_id);
    return (
      c.type.includes(q) ||
      c.target.toLowerCase().includes(q) ||
      owner?.email?.toLowerCase().includes(q) ||
      owner?.display_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search channels by type, target, owner…"
        className="max-w-md bg-background"
      />
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
            {filtered.map((c) => {
              const owner = userById.get(c.user_id);
              return (
                <tr key={c.id} className="border-t border-border/60">
                  <td className="px-4 py-3">
                    <div>{owner?.email ?? owner?.display_name ?? "—"}</div>
                    <div className="text-xs font-mono text-muted-foreground">{c.user_id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{c.type}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-xs">
                    {c.target}
                  </td>
                  <td className="px-4 py-3">
                    <span className={c.is_active ? "text-emerald-400" : "text-muted-foreground"}>
                      {c.is_active ? "yes" : "no"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(c.created_at).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  {channels.length === 0 ? "No notification channels" : "No channels match your search"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
