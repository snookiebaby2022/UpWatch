import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  (typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined);
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (typeof process !== "undefined" ? process.env.SUPABASE_PUBLISHABLE_KEY : undefined);

/** True when the URL contains Supabase OAuth / magic-link callback params. */
export function urlHasAuthCallback() {
  if (typeof window === "undefined") return false;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (
    search.has("code") ||
    hash.has("access_token") ||
    hash.has("refresh_token") ||
    search.get("error") != null
  );
}

/** Exchange OAuth code / hash tokens into a session (PKCE + implicit). */
export async function completeAuthFromUrl() {
  if (typeof window === "undefined" || !urlHasAuthCallback()) {
    return { session: null as null, error: null as null };
  }

  const search = new URLSearchParams(window.location.search);
  const authError = search.get("error_description") ?? search.get("error");
  if (authError) {
    return { session: null, error: new Error(authError) };
  }

  const code = search.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { session: null, error };
    window.history.replaceState({}, document.title, window.location.pathname);
    return { session: data.session, error: null };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) return { session: null, error };

  if (data.session) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  return { session: data.session, error: null };
}

export function googleOAuthRedirectUrl() {
  return `${typeof window !== "undefined" ? window.location.origin : "https://upwatch.online"}/dashboard`;
}

/** Returns true when Supabase has Google client id + secret saved (not just the toggle). */
export async function googleOAuthReady() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { ready: false as const, reason: "missing_env" as const };

  const redirectTo = encodeURIComponent(googleOAuthRedirectUrl());
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`,
    { headers: { apikey: SUPABASE_KEY }, redirect: "manual" },
  );

  if (res.status === 302 || res.status === 303) return { ready: true as const };

  if (res.status === 400) {
    const body = (await res.json().catch(() => null)) as { msg?: string } | null;
    if (body?.msg?.includes("missing OAuth secret")) {
      return { ready: false as const, reason: "missing_secret" as const };
    }
    return {
      ready: false as const,
      reason: "provider_error" as const,
      message: body?.msg ?? "Google sign-in is not configured.",
    };
  }

  return { ready: false as const, reason: "unknown" as const };
}
