import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — UpWatch" },
      { name: "description", content: "Sign in or create your UpWatch account to monitor your websites." },
    ],
  }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [lastSignupEmail, setLastSignupEmail] = useState<string | null>(null);

  // If already signed in, bounce to dashboard.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === "forgot") {
      const trimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setError("Enter a valid email");
        return;
      }
      setLoading(true);
      const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setLoading(false);
      if (err) return setError(err.message);
      setInfo("Check your inbox for a password reset link.");
      return;
    }

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: displayName.trim() || undefined },
          },
        });
        if (err) throw err;
        // If email confirmation is disabled, Supabase returns a session immediately — go straight in.
        if (data.session) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        setLastSignupEmail(parsed.data.email);
        setInfo("Account created. Check your inbox to confirm your email.");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (err) throw err;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    const target = lastSignupEmail ?? email.trim().toLowerCase();
    if (!target) {
      setError("Enter your email above first.");
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email: target,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (err) return setError(err.message);
    setInfo("Verification email sent.");
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(result.error.message ?? "Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen bg-bg text-zinc-300 font-sans flex flex-col">
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-brand animate-pulse" />
          <span className="text-white font-bold tracking-tight text-xl">UpWatch</span>
        </Link>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-surface rounded-2xl border border-brand-border p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-1">
            {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
          </h1>
          <p className="text-sm text-zinc-500 mb-6">
            {mode === "signin"
              ? "Sign in to manage your monitors."
              : mode === "signup"
                ? "Free forever plan — 5 monitors included."
                : "Enter your email and we'll send you a reset link."}
          </p>

          {mode !== "forgot" && (
            <>
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white text-black px-4 py-3 rounded-xl font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-60"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41.4 35.6 44 30.2 44 24c0-1.3-.1-2.3-.4-3.5z"/>
                </svg>
                Continue with Google
              </button>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-brand-border" />
                <span className="text-xs font-mono text-zinc-600 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-brand-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">
                  Display name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={80}
                  className="w-full bg-bg border border-brand-border rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand transition-colors"
                  placeholder="Ada Lovelace"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                className="w-full bg-bg border border-brand-border rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand transition-colors"
                placeholder="you@example.com"
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-zinc-500">
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setError(null); setInfo(null); }}
                      className="text-xs text-brand hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={72}
                  className="w-full bg-bg border border-brand-border rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand transition-colors"
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            {info && (
              <div className="text-sm text-brand bg-brand/10 border border-brand-border rounded-lg px-3 py-2">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand text-bg px-4 py-3 rounded-xl font-bold hover:scale-[1.01] transition-transform disabled:opacity-60"
            >
              {loading ? "…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </button>
          </form>

          {mode === "signup" && lastSignupEmail && (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={loading}
              className="w-full text-xs text-zinc-400 hover:text-brand mt-4"
            >
              Didn't get the email? Resend verification
            </button>
          )}

          <p className="text-sm text-zinc-500 text-center mt-6">
            {mode === "forgot" ? (
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); setInfo(null); }}
                className="text-brand hover:underline font-semibold"
              >
                Back to sign in
              </button>
            ) : (
              <>
                {mode === "signin" ? "New to UpWatch? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin");
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-brand hover:underline font-semibold"
                >
                  {mode === "signin" ? "Create an account" : "Sign in"}
                </button>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
