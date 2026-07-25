import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

/** Unread in-app notifications for the signed-in user (realtime). */
export function useUnreadNotificationCount() {
  const signedIn = useSession();
  const [userId, setUserId] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!signedIn) {
      setUserId(null);
      setCount(0);
      return;
    }
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [signedIn]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { count: unread, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);
    if (!error && unread != null) setCount(unread);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`unread-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  return count;
}
