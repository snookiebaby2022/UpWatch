import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isPublicHttpUrl } from "@/lib/url-safety";
import { NotificationBell } from "@/components/NotificationBell";
import { ChannelsPanel } from "@/components/ChannelsPanel";
import type { Plan } from "@/lib/plans";
import { PLAN_INTERVAL_SECONDS, PLAN_LABEL, PLAN_LIMITS } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — UpWatch" },
      { name: "description", content: "Manage your uptime monitors and billing." },
    ],
  }),
  component: Dashboard,
});

const STRIPE_PRO_URL = "https://buy.stripe.com/14A5kDeEQb1o61s1a2ebu00";
const STRIPE_BUSINESS_URL = "https://buy.stripe.com/5kQ00j7coedA3Tk5qiebu01";

type Monitor = {
  id: string;
  name: string;
  url: string;
  interval_seconds: number;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  last_status?: string | null;
  last_checked_at?: string | null;
};

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!data.user) return;
        setEmail(data.user.email ?? "");
        setUserId(data.user.id);
        const [profileRes, adminRes] = await Promise.all([
          supabase.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle(),
          supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" }),
        ]);
        if (profileRes.error) console.error("profile load failed", profileRes.error);
        if (adminRes.error) console.error("role check failed", adminRes.error);
        setDisplayName(profileRes.data?.display_name ?? "");
        setIsAdmin(!!adminRes.data);
      } catch (err) {
        console.error("dashboard init failed", err);
      }
    })();
  }, []);

  const monitorsQuery = useQuery({
    queryKey: ["monitors", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitors")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Monitor[];
    },
  });

  // Note: we intentionally do NOT merge in the external upwatch.online status
  // feed. Fuzzy-matching by name/URL could surface another tenant's row under
  // this user's monitor. `monitors.last_status` from our own runner is the
  // source of truth.


  const subscriptionQuery = useQuery({
    queryKey: ["subscription", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("plan, status, current_period_end")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
  });

  const plan: Plan =
    subscriptionQuery.data?.status === "active" && subscriptionQuery.data?.plan
      ? ((subscriptionQuery.data.plan as Plan) ?? "starter")
      : "starter";
  const limit = PLAN_LIMITS[plan];
  const used = monitorsQuery.data?.length ?? 0;

  async function handleSignOut() {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("sign out failed", err);
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
          <Link to="/status" className="text-sm text-zinc-400 hover:text-white transition-colors">
            Status page
          </Link>

          <Link to="/support" className="text-sm text-zinc-400 hover:text-white transition-colors">
            Support
          </Link>
          {isAdmin && (
            <Link to="/admin" className="text-sm text-brand hover:text-white transition-colors">
              Admin
            </Link>
          )}
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
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
            Welcome{displayName ? `, ${displayName}` : ""}.
          </h1>
          <p className="text-zinc-400">Signed in as {email}</p>
        </div>

        <MonitorsPanel
          monitors={monitorsQuery.data ?? []}
          isLoading={monitorsQuery.isLoading}
          error={monitorsQuery.error as Error | null}
          userId={userId}
          plan={plan}
          used={used}
          limit={limit}
          onChange={() => queryClient.invalidateQueries({ queryKey: ["monitors", userId] })}

        />

        <ChannelsPanel userId={userId} plan={plan} />

        <BillingPanel plan={plan} />
      </main>
    </div>
  );
}

function MonitorsPanel({
  monitors,
  isLoading,
  error,
  userId,
  plan,
  used,
  limit,
  onChange,
}: {
  monitors: Monitor[];
  isLoading: boolean;
  error: Error | null;
  userId: string;
  plan: Plan;
  used: number;
  limit: number;
  onChange: () => void;
}) {

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const atLimit = used >= limit;
  const limitLabel = limit === Infinity ? "∞" : String(limit);

  async function addMonitor(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (atLimit) {
      setMsg(`You've reached your ${PLAN_LABEL[plan]} plan limit (${limitLabel} monitors). Upgrade below.`);
      return;
    }
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) {
      setMsg("Name and URL are required.");
      return;
    }
    const safety = isPublicHttpUrl(trimmedUrl);
    if (!safety.ok) {
      setMsg(safety.reason);
      return;
    }
    setMsg(null);
    setBusy(true);
    try {
      const { error: insertError } = await supabase
        .from("monitors")
        .insert({ user_id: userId, name: trimmedName, url: trimmedUrl, interval_seconds: PLAN_INTERVAL_SECONDS[plan] });
      if (insertError) {
        setMsg(insertError.message);
        return;
      }
      setName("");
      setUrl("");
      onChange();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to add monitor.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMonitor(id: string) {
    try {
      const { error: delError } = await supabase.from("monitors").delete().eq("id", id);
      if (delError) {
        setMsg(delError.message);
        return;
      }
      onChange();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to delete monitor.");
    }
  }

  async function togglePublic(id: string, next: boolean) {
    try {
      const { error: updErr } = await supabase.from("monitors").update({ is_public: next }).eq("id", id);
      if (updErr) {
        setMsg(updErr.message);
        return;
      }
      onChange();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to update monitor.");
    }
  }


  return (
    <section className="bg-surface rounded-2xl border border-brand-border p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-white font-semibold text-xl">Your monitors</h2>
          <p className="text-zinc-500 text-sm mt-1">
            You're on the <span className="text-brand font-semibold">{PLAN_LABEL[plan]}</span> plan.
          </p>
        </div>
        <div className="text-xs font-mono text-zinc-500">
          <span className={atLimit ? "text-red-400" : "text-brand"}>{used}</span>
          <span className="text-zinc-600"> / {limitLabel}</span> monitors used
        </div>
      </div>

      <form
        onSubmit={addMonitor}
        className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3 mb-6"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Name (e.g. Marketing site)"
          className="bg-bg border border-brand-border rounded-lg px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          required
          placeholder="https://example.com"
          className="bg-bg border border-brand-border rounded-lg px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={busy || atLimit}
          className="bg-brand text-bg font-bold px-5 py-3 rounded-lg text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {atLimit ? "Limit reached" : busy ? "Adding…" : "Add monitor"}
        </button>
      </form>

      {msg && <p className="text-sm text-red-400 mb-4">{msg}</p>}

      {isLoading ? (
        <div className="text-sm text-zinc-500 py-10 text-center font-mono">Loading monitors…</div>
      ) : error ? (
        <div className="text-sm text-red-400 py-10 text-center font-mono">
          Failed to load monitors.
        </div>
      ) : monitors.length === 0 ? (
        <div className="text-sm text-zinc-500 py-10 text-center font-mono border border-dashed border-brand-border rounded-xl">
          No monitors yet — add one above to get started.
        </div>
      ) : (
        <ul className="divide-y divide-brand-border/50 border border-brand-border rounded-xl overflow-hidden">
          {monitors.map((m) => {
            const status = m.last_status ?? "pending";
            return (
              <li key={m.id} className="flex items-center justify-between px-5 py-4 bg-bg/40">
                <div className="min-w-0">
                  <div className="text-white font-medium truncate">{m.name}</div>
                  <div className="text-xs text-zinc-500 font-mono truncate">{m.url}</div>
                </div>
                <div className="flex items-center gap-4">

                  <span className="text-xs font-mono text-zinc-500">
                    every {m.interval_seconds < 60 ? `${m.interval_seconds}s` : `${Math.round(m.interval_seconds / 60)}m`}
                  </span>
                  <StatusBadge status={status} />
                  <label className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 cursor-pointer select-none" title="Show this monitor on the public /status page">
                    <input
                      type="checkbox"
                      checked={m.is_public}
                      onChange={(e) => togglePublic(m.id, e.target.checked)}
                      className="accent-brand"
                    />
                    Public
                  </label>
                  <button
                    onClick={() => removeMonitor(m.id)}
                    className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </div>

              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "up"
      ? "text-brand"
      : status === "down"
        ? "text-red-400"
        : "text-zinc-500";
  const label = status === "up" ? "● up" : status === "down" ? "● down" : "○ pending";
  return <span className={`text-xs font-mono ${cls}`}>{label}</span>;
}

function BillingPanel({ plan }: { plan: Plan }) {
  return (
    <section className="bg-surface rounded-2xl border border-brand-border p-8">
      <h2 className="text-white font-semibold text-xl mb-1">Billing</h2>
      <p className="text-zinc-500 text-sm mb-6">
        You're currently on the <span className="text-brand font-semibold">{PLAN_LABEL[plan]}</span> plan.
        {plan === "starter" ? " Upgrade any time — no migration, no downtime." : " Manage your subscription in Stripe."}
      </p>
      {plan !== "business" && (
        <div className="grid md:grid-cols-2 gap-4">
          {plan === "starter" && (
            <a
              href={STRIPE_PRO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-brand-border bg-bg/40 p-5 hover:border-brand transition-colors"
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-white font-semibold">Pro</span>
                <span className="text-brand font-mono">£10/mo</span>
              </div>
              <p className="text-xs text-zinc-500">50 monitors · 5-minute checks · Slack & Discord</p>
            </a>
          )}
          <a
            href={STRIPE_BUSINESS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-brand-border bg-bg/40 p-5 hover:border-brand transition-colors"
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-white font-semibold">Business</span>
              <span className="text-brand font-mono">£30/mo</span>
            </div>
            <p className="text-xs text-zinc-500">Unlimited monitors · 1-minute checks · Multi-region</p>
          </a>
        </div>
      )}
    </section>
  );
}
