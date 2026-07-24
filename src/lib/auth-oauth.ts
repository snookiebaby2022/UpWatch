import { supabase } from "@/integrations/supabase/client";

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
