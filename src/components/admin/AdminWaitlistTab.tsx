import { Input } from "@/components/ui/input";
import type { WaitlistRow } from "./types";

export function AdminWaitlistTab({
  waitlist,
  search,
  onSearchChange,
  onDelete,
}: {
  waitlist: WaitlistRow[];
  search: string;
  onSearchChange: (v: string) => void;
  onDelete: (id: string) => void;
}) {
  const q = search.trim().toLowerCase();
  const filtered = waitlist.filter((w) => !q || w.email.toLowerCase().includes(q));

  function exportCsv() {
    const rows = [["email", "signed_up"], ...filtered.map((w) => [w.email, w.created_at])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `upwatch-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search waitlist by email…"
          className="max-w-md bg-background"
        />
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="text-xs px-3 py-2 border border-border/60 rounded hover:border-brand disabled:opacity-40"
        >
          Export CSV ({filtered.length})
        </button>
      </div>
      <div className="overflow-x-auto border border-border/60 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Signed up</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => (
              <tr key={w.id} className="border-t border-border/60">
                <td className="px-4 py-3">{w.email}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(w.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDelete(w.id)}
                    className="text-xs px-2 py-1 border border-border/60 rounded hover:border-red-500 text-red-400"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  {waitlist.length === 0 ? "No signups yet" : "No entries match your search"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
