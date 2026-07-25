import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isPublicHttpUrl } from "@/lib/url-safety";
import { NotificationBell } from "@/components/NotificationBell";
import { ChannelsPanel } from "@/components/ChannelsPanel";
import type { Plan } from "@/lib/plans";
import { resolveAdminAccess } from "@/lib/admin-access";
import { PLAN_FEATURES, PLAN_INTERVAL_SECONDS, PLAN_LABEL, PLAN_LIMITS } from "@/lib/plans";
import { normalizeMonitorStatus } from "@/lib/monitor-status";

async function authFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (search: Record<string, unknown>) => ({
    welcome: search.welcome === true || search.welcome === "true" || search.welcome === "1",
  }),
  head: () => ({
    meta: [
      { title: "Dashboard — UpWatch" },
      { name: "description", content: "Manage your uptime monitors and billing." },
    ],
  }),
  component: Dashboard,
});

type Monitor = {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  last_status?: string | null;
  last_checked_at?: string | null;
};

function Dashboard() {
  const navigate = useNavigate();
  const { welcome } = Route.useSearch();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showWelcome, setShowWelcome] = useState(welcome);

  useEffect(() => {
    if (!welcome) return;
    navigate({ to: "/dashboard", search: {}, replace: true });
  }, [welcome, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const { data, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!data.user) return;
        setEmail(data.user.email ?? "");
        setUserId(data.user.id);
        const [profileRes, adminAccess] = await Promise.all([
          supabase.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle(),
          resolveAdminAccess(data.user.id),
        ]);
        if (profileRes.error) console.error("profile load failed", profileRes.error);
        setDisplayName(profileRes.data?.display_name ?? "");
        setIsAdmin(adminAccess.isAdmin);
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
        .select("plan, status, current_period_end, stripe_customer_id")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
  });

  const subStatus = subscriptionQuery.data?.status;
  const subPlan = subscriptionQuery.data?.plan as Plan | undefined;
  const plan: Plan =
    (subStatus === "active" || subStatus === "trialing") && subPlan ? subPlan : "starter";
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

          <Link to="/tickets" className="text-sm text-zinc-400 hover:text-white transition-colors">
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
        {showWelcome && (
          <div className="rounded-xl border border-brand/40 bg-brand/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-white font-semibold">You're in — add your first monitor below</p>
              <p className="text-sm text-zinc-400 mt-1">
                Paste any HTTPS URL. We'll email you when it goes down. Your free plan includes 5 monitors.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWelcome(false)}
              className="text-sm text-zinc-400 hover:text-white shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

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

        <PlanFeaturesPanel plan={plan} used={used} limit={limit} />

        <ChannelsPanel userId={userId} plan={plan} />

        <BillingPanel
          plan={plan}
          hasStripeCustomer={!!subscriptionQuery.data?.stripe_customer_id}
        />

        <AccountPanel onDeleted={handleSignOut} />
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
        .insert({ user_id: userId, name: trimmedName, url: trimmedUrl });
      if (insertError) {
        setMsg(insertError.message);
        return;
      }
      setName("");
      setUrl("");
      onChange();
      // First check immediately so new monitors don't sit on "pending"
      void fetch("/api/public/hooks/run-monitors", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: "{}",
      }).then(() => onChange());
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
        <div className="text-sm text-zinc-500 py-10 text-center font-mono border border-dashed border-brand-border rounded-xl space-y-2">
          <p className="text-white font-sans font-medium">No monitors yet</p>
          <p>Add your website or API URL above — checks start within a minute.</p>
          <p className="text-zinc-600 text-xs">Example: https://yourdomain.com</p>
        </div>
      ) : (
        <ul className="divide-y divide-brand-border/50 border border-brand-border rounded-xl overflow-hidden">
          {monitors.map((m) => {
            const status = normalizeMonitorStatus(m.last_status);
            return (
              <li key={m.id} className="flex items-center justify-between px-5 py-4 bg-bg/40">
                <div className="min-w-0">
                  <div className="text-white font-medium truncate">{m.name}</div>
                  <div className="text-xs text-zinc-500 font-mono truncate">{m.url}</div>
                </div>
                <div className="flex items-center gap-4">

                  <span className="text-xs font-mono text-zinc-500">
                    every {PLAN_INTERVAL_SECONDS[plan] < 60 ? `${PLAN_INTERVAL_SECONDS[plan]}s` : `${Math.round(PLAN_INTERVAL_SECONDS[plan] / 60)}m`}
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
  const normalized = normalizeMonitorStatus(status);
  const cls =
    normalized === "up"
      ? "text-brand"
      : normalized === "down"
        ? "text-red-400"
        : "text-zinc-500";
  const label = normalized === "up" ? "● up" : normalized === "down" ? "● down" : "○ pending";
  return <span className={`text-xs font-mono ${cls}`}>{label}</span>;
}

function PlanFeaturesPanel({ plan, used, limit }: { plan: Plan; used: number; limit: number }) {
  const intervalMin = PLAN_INTERVAL_SECONDS[plan] / 60;
  return (
    <section className="bg-surface rounded-2xl border border-brand-border p-6">
      <h2 className="text-white font-semibold text-lg mb-1">Your {PLAN_LABEL[plan]} plan</h2>
      <p className="text-zinc-500 text-sm mb-4">
        {limit === Infinity ? `${used} monitors` : `${used} / ${limit} monitors`} · checks every{" "}
        {intervalMin >= 1 ? `${intervalMin} min` : `${PLAN_INTERVAL_SECONDS[plan]}s`}
      </p>
      <ul className="grid sm:grid-cols-3 gap-2 text-sm text-zinc-400">
        {PLAN_FEATURES[plan].map((f) => (
          <li key={f} className="flex items-center gap-2">
            <span className="text-brand">✓</span>
            {f}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BillingPanel({
  plan,
  hasStripeCustomer,
}: {
  plan: Plan;
  hasStripeCustomer: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function startCheckout(target: "pro" | "business") {
    setMsg(null);
    setBusy(target);
    try {
      const res = await authFetch("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: target }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setMsg(data.error ?? "Checkout failed");
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setMsg(null);
    setBusy("portal");
    try {
      const res = await authFetch("/api/stripe/portal", { method: "POST", body: "{}" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setMsg(data.error ?? "Could not open billing portal");
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Portal failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="bg-surface rounded-2xl border border-brand-border p-8">
      <h2 className="text-white font-semibold text-xl mb-1">Billing</h2>
      <p className="text-zinc-500 text-sm mb-6">
        You're currently on the <span className="text-brand font-semibold">{PLAN_LABEL[plan]}</span> plan.
        {plan === "starter"
          ? " Upgrade any time — no migration, no downtime."
          : " Manage payment method, invoices, or cancel in the Stripe billing portal."}
      </p>

      {hasStripeCustomer && (
        <button
          type="button"
          onClick={openPortal}
          disabled={!!busy}
          className="mb-6 text-sm font-semibold text-brand hover:text-white transition-colors disabled:opacity-60"
        >
          {busy === "portal" ? "Opening portal…" : "Open Stripe billing portal →"}
        </button>
      )}

      {msg && <p className="text-sm text-red-400 mb-4">{msg}</p>}

      {plan !== "business" && (
        <div className="grid md:grid-cols-2 gap-4">
          {plan === "starter" && (
            <button
              type="button"
              onClick={() => startCheckout("pro")}
              disabled={!!busy}
              className="text-left rounded-xl border border-brand-border bg-bg/40 p-5 hover:border-brand transition-colors disabled:opacity-60"
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-white font-semibold">Pro</span>
                <span className="text-brand font-mono">£10/mo</span>
              </div>
              <p className="text-xs text-zinc-500">50 monitors · 5-minute checks · Slack & Discord</p>
              {busy === "pro" && <p className="text-xs text-brand mt-2">Redirecting to checkout…</p>}
            </button>
          )}
          <button
            type="button"
            onClick={() => startCheckout("business")}
            disabled={!!busy}
            className="text-left rounded-xl border border-brand-border bg-bg/40 p-5 hover:border-brand transition-colors disabled:opacity-60"
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-white font-semibold">Business</span>
              <span className="text-brand font-mono">£30/mo</span>
            </div>
            <p className="text-xs text-zinc-500">Unlimited monitors · 1-minute checks · Triple-probe consensus</p>
            {busy === "business" && <p className="text-xs text-brand mt-2">Redirecting to checkout…</p>}
          </button>
        </div>
      )}
    </section>
  );
}

function AccountPanel({ onDeleted }: { onDeleted: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function deleteAccount() {
    if (confirmText !== "DELETE") {
      setMsg('Type DELETE to confirm.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await authFetch("/api/account/delete", {
        method: "POST",
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMsg(data.error ?? "Deletion failed");
        return;
      }
      onDeleted();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Deletion failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-surface rounded-2xl border border-red-900/40 p-8">
      <h2 className="text-white font-semibold text-xl mb-1">Account</h2>
      <p className="text-zinc-500 text-sm mb-4">
        Permanently delete your account, monitors, alerts, and subscription data. This cannot be undone.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 max-w-md">
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder='Type DELETE to confirm'
          className="flex-1 bg-bg border border-brand-border rounded-lg px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500"
        />
        <button
          type="button"
          onClick={deleteAccount}
          disabled={busy}
          className="bg-red-600/20 border border-red-600/50 text-red-300 font-semibold px-5 py-3 rounded-lg text-sm hover:bg-red-600/30 disabled:opacity-60"
        >
          {busy ? "Deleting…" : "Delete account"}
        </button>
      </div>
      {msg && <p className="text-sm text-red-400 mt-3">{msg}</p>}
    </section>
  );
}
