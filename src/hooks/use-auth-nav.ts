import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** When signed in, marketing/status nav targets the dashboard instead of the landing page. */
export function useAuthNav() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSignedIn(!!data.session);
      setUserId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setSignedIn(!!session);
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const authed = signedIn === true;

  return {
    loading: signedIn === null,
    signedIn: authed,
    userId,
    homeTo: authed ? "/dashboard" : "/",
    homeLabel: authed ? "Dashboard" : "Home",
    backLabel: authed ? "← Back to dashboard" : "← Back to home",
  };
}
