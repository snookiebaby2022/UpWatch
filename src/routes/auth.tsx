import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { completeAuthFromUrl } from "@/lib/auth-oauth";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — UpWatch" },
      { name: "description", content: "Sign in or create your UpWatch account to monitor your websites." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function authErrorMessage(err: unknown, mode: "signin" | "signup") {
  if (!(err instanceof Error)) return "Something went wrong";
  const msg = err.message;
  if (mode === "signin" && /invalid login credentials/i.test(msg)) {
    return "That password didn't work. If you just signed up, confirm your email first — or use Email me a login link below (works without a password).";
  }
  if (/email not confirmed/i.test(msg)) {
    return "Confirm your email first — check your inbox (and spam), or resend the verification link below.";
  }
  if (/user already registered/i.test(msg)) {
    return "An account with this email already exists. Sign in instead, or use Forgot password?";
  }
  return msg;
}

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

  // Complete OAuth / magic-link callback, then bounce to dashboard if signed in.
  useEffect(() => {
    (async () => {
      try {
        const { session, error: callbackErr } = await completeAuthFromUrl();
        if (callbackErr) {
          setError(callbackErr.message);
          return;
        }
        if (session) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        const { data } = await supabase.auth.getUser();
        if (data.user) navigate({ to: "/dashboard", replace: true });
      } catch (err) {
        console.error("auth init failed", err);
      }
    })();
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
      try {
        const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) {
          setError(err.message);
          return;
        }
        setInfo("Check your inbox for a password reset link.");
      } catch (err) {
        console.error("password reset failed", err);
        setError(err instanceof Error ? err.message : "Couldn't send reset link.");
      } finally {
        setLoading(false);
      }
      return;
    }

    const parsed = credentialsSchema.safeParse({
      email: normalizeEmail(email),
      password,
    });
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
      setError(authErrorMessage(err, mode === "signup" ? "signup" : "signin"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    const target = normalizeEmail(lastSignupEmail ?? email);
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
    setInfo("Verification email sent — check your inbox and spam folder.");
  }

  async function handleMagicLink() {
    const target = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setError("Enter a valid email above first.");
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: target,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (err) return setError(err.message);
    setInfo(`Login link sent to ${target}. Click it in your email to sign in — no password needed.`);
  }

  async function handleGoogleSuccess() {
    const { data, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !data.session) {
      setError("Google sign-in did not create a session. Try email sign-in or refresh the page.");
      return;
    }
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
              <GoogleSignInButton
                disabled={loading}
                onSuccess={handleGoogleSuccess}
                onError={(msg) => {
                  console.error("google sign-in failed", msg);
                  setError(msg);
                }}
              />
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
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2 space-y-2">
                <p>{error}</p>
                {mode === "signin" && /password didn't work|invalid login credentials|confirm your email/i.test(error) && (
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleMagicLink}
                      disabled={loading}
                      className="text-brand hover:underline font-semibold text-left"
                    >
                      Email me a login link
                    </button>
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={loading}
                      className="text-brand hover:underline font-semibold text-left"
                    >
                      Resend confirmation email
                    </button>
                  </div>
                )}
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

          {mode === "signin" && (
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={loading}
              className="w-full mt-3 text-sm text-zinc-400 hover:text-brand border border-brand-border rounded-xl px-4 py-3 transition-colors disabled:opacity-60"
            >
              Email me a login link (no password)
            </button>
          )}

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
