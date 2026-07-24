import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Channel = {
  id: string;
  type: string;
  target: string;
  is_active: boolean;
  created_at: string;
};

const CHANNEL_META: Record<string, { label: string; placeholder: string; hint: string }> = {
  email: {
    label: "Email",
    placeholder: "alerts@yourcompany.com",
    hint: "Delivered via our transactional email provider.",
  },
  slack: {
    label: "Slack",
    placeholder: "https://hooks.slack.com/services/…",
    hint: "Create an Incoming Webhook in Slack and paste the URL.",
  },
  discord: {
    label: "Discord",
    placeholder: "https://discord.com/api/webhooks/…",
    hint: "Server Settings → Integrations → Webhooks → New Webhook.",
  },
  telegram: {
    label: "Telegram",
    placeholder: "123456789 (your chat ID)",
    hint: "Message @UpWatchAlertsBot then run /start — it replies with your chat ID.",
  },
};

export function ChannelsPanel({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<keyof typeof CHANNEL_META>("email");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notification_channels")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as Channel[]);
    } catch (err) {
      console.error("channels: refresh failed", err);
      setMsg(err instanceof Error ? err.message : "Failed to load channels.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function addChannel(e: React.FormEvent) {
    e.preventDefault();
    const t = target.trim();
    if (!t) return;
    if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
      setMsg("Enter a valid email address.");
      return;
    }
    if ((type === "slack" || type === "discord") && !/^https:\/\//.test(t)) {
      setMsg("Webhook URL must start with https://");
      return;
    }
    if (type === "telegram" && !/^-?\d+$/.test(t)) {
      setMsg("Telegram chat ID should be a number.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("notification_channels")
        .insert({ user_id: userId, type, target: t, is_active: true });
      if (error) throw error;
      setTarget("");
      await refresh();
    } catch (err) {
      console.error("channels: insert failed", err);
      setMsg(err instanceof Error ? err.message : "Failed to add channel.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, next: boolean) {
    try {
      const { error } = await supabase
        .from("notification_channels")
        .update({ is_active: next })
        .eq("id", id);
      if (error) throw error;
      await refresh();
    } catch (err) {
      console.error("channels: toggle failed", err);
      setMsg(err instanceof Error ? err.message : "Failed to update channel.");
    }
  }

  async function remove(id: string) {
    try {
      const { error } = await supabase.from("notification_channels").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    } catch (err) {
      console.error("channels: delete failed", err);
      setMsg(err instanceof Error ? err.message : "Failed to delete channel.");
    }
  }


  return (
    <section className="bg-surface rounded-2xl border border-brand-border p-8">
      <h2 className="text-white font-semibold text-xl mb-1">Alert channels</h2>
      <p className="text-zinc-500 text-sm mb-6">
        Get notified the instant a monitor goes down — email, Slack, Discord, or Telegram.
      </p>

      <form onSubmit={addChannel} className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-3 mb-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as keyof typeof CHANNEL_META)}
          className="bg-bg border border-brand-border rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-brand"
        >
          {Object.entries(CHANNEL_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={CHANNEL_META[type].placeholder}
          required
          className="bg-bg border border-brand-border rounded-lg px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-brand text-bg font-bold px-5 py-3 rounded-lg text-sm hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </form>
      <p className="text-xs text-zinc-500 mb-6 font-mono">{CHANNEL_META[type].hint}</p>

      {msg && <p className="text-sm text-red-400 mb-4">{msg}</p>}

      {loading ? (
        <div className="text-sm text-zinc-500 py-6 text-center font-mono">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-zinc-500 py-8 text-center font-mono border border-dashed border-brand-border rounded-xl">
          No channels yet — add one above.
        </div>
      ) : (
        <ul className="divide-y divide-brand-border/50 border border-brand-border rounded-xl overflow-hidden">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-5 py-4 bg-bg/40">
              <div className="min-w-0">
                <div className="text-white font-medium capitalize">
                  {CHANNEL_META[c.type]?.label ?? c.type}
                </div>
                <div className="text-xs text-zinc-500 font-mono truncate max-w-md">{c.target}</div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={c.is_active}
                    onChange={(e) => toggle(c.id, e.target.checked)}
                    className="accent-brand"
                  />
                  Active
                </label>
                <button
                  onClick={() => remove(c.id)}
                  className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
