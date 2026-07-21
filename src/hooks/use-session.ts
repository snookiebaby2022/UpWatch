import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared session hook. Returns `null` while loading, `true` when signed in,
 * `false` when signed out. Deduplicates the `getSession` + `onAuthStateChange`
 * pattern used across Nav, Dashboard, Admin, and Auth.
 */
export function useSession() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setSignedIn(!!session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return signedIn;
}
