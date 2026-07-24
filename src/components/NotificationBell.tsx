import { useEffect, useState, useCallback, useRef } from "react";
import { Bell, Check } from "lucide-react";
import { Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useSession } from "@/hooks/use-session";


type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const signedIn = useSession();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);


  useEffect(() => {
    if (!signedIn) {
      setUserId(null);
      return;
    }
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [signedIn]);
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(
    typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted",
  );
  const seenIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) {
      setItems(data as Notification[]);
      for (const n of data) seenIds.current.add(n.id);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime — new notifications trigger toast + browser push
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          if (seenIds.current.has(n.id)) return;
          seenIds.current.add(n.id);
          setItems((cur) => [n, ...cur].slice(0, 30));

          // Toast pop-up
          toast(n.title, {
            description: n.body ?? undefined,
            action: n.link
              ? { label: "Open", onClick: () => (window.location.href = n.link!) }
              : undefined,
          });

          // Browser push (works while any app tab is open)
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              const notif = new Notification(n.title, {
                body: n.body ?? undefined,
                icon: "/favicon.png",
                tag: n.id,
              });
              if (n.link) {
                notif.onclick = () => {
                  window.focus();
                  window.location.href = n.link!;
                };
              }
            } catch (e) {
              console.warn("browser notification failed", e);
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function markAllRead() {
    if (!userId) return;
    const unread = items.filter((i) => !i.read).map((i) => i.id);
    if (!unread.length) return;
    setItems((cur) => cur.map((i) => ({ ...i, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", unread);
  }

  async function markOne(id: string) {
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, read: true } : i)));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }

  async function requestPush() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Your browser doesn't support notifications.");
      return;
    }
    const perm = await Notification.requestPermission();
    setPushEnabled(perm === "granted");
    if (perm === "granted") {
      toast.success("Browser notifications enabled");
      new Notification("UpWatch notifications enabled", {
        body: "You'll get pop-ups when your monitors change state.",
        icon: "/favicon.png",
      });
    } else {
      toast.error("Notifications permission denied");
    }
  }

  const unreadCount = items.filter((i) => !i.read).length;

  if (!userId) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-full text-zinc-400 hover:text-white hover:bg-surface transition-colors"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-[10px] font-bold text-black flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-96 p-0 bg-surface border-brand-border text-zinc-200"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
          <div className="font-semibold text-white">Notifications</div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-brand hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {!pushEnabled && (
          <button
            onClick={requestPush}
            className="w-full text-left px-4 py-2 text-xs bg-brand/10 text-brand hover:bg-brand/20 border-b border-brand-border"
          >
            🔔 Enable browser pop-ups for down alerts →
          </button>
        )}

        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              You're all caught up.
            </div>
          ) : (
            items.map((n) => {
              const body = (
                <div
                  className={`px-4 py-3 border-b border-brand-border/50 hover:bg-black/30 transition-colors ${
                    !n.read ? "bg-brand/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                          {n.body}
                        </div>
                      )}
                      <div className="text-[10px] text-zinc-500 mt-1">
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                    {!n.read && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          markOne(n.id);
                        }}
                        className="text-zinc-500 hover:text-white shrink-0"
                        aria-label="Mark read"
                      >
                        <Check className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
              return n.link ? (
                <Link
                  key={n.id}
                  to={n.link}
                  onClick={() => {
                    markOne(n.id);
                    setOpen(false);
                  }}
                >
                  {body}
                </Link>
              ) : (
                <div key={n.id}>{body}</div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
