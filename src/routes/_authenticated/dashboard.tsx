import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setEmail(data.user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", data.user.id)
        .maybeSingle();
      setDisplayName(profile?.display_name ?? "");
    })();
  }, []);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-bg text-zinc-300 font-sans">
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-brand animate-pulse" />
          <span className="text-white font-bold tracking-tight text-xl">UpWatch</span>
        </Link>
        <button
          onClick={handleSignOut}
          className="bg-surface border border-brand-border px-4 py-2 rounded-full text-sm font-semibold text-white hover:bg-brand-border transition-colors"
        >
          Sign out
        </button>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
          Welcome{displayName ? `, ${displayName}` : ""}.
        </h1>
        <p className="text-zinc-400 mb-12">Signed in as {email}</p>

        <div className="bg-surface rounded-2xl border border-brand-border p-8">
          <h2 className="text-white font-semibold text-xl mb-3">Your monitors</h2>
          <p className="text-zinc-500 text-sm mb-6">
            You're on the Starter plan. Add up to 5 monitors with 5-minute checks.
          </p>
          <div className="text-sm text-zinc-500 py-12 text-center font-mono border border-dashed border-brand-border rounded-xl">
            No monitors yet — add one to get started.
          </div>
        </div>
      </main>
    </div>
  );
}
