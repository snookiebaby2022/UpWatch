import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { SITE_URL, OG_IMAGE } from "@/lib/site";
import { getPublicStatus } from "@/lib/status.functions";
import { OverallStatusBanner, StatusMonitorList } from "@/components/StatusMonitorList";
import { useAuthNav } from "@/hooks/use-auth-nav";

const TITLE = "Live System Status — UpWatch";
const DESC = "Real-time uptime for your public UpWatch monitors.";

function statusQueryOptions(userId?: string) {
  return queryOptions({
    queryKey: ["public-status", userId ?? "all"],
    queryFn: () => getPublicStatus({ data: userId ? { userId } : {} }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export const Route = createFileRoute("/status")({
  loader: ({ context }) => context.queryClient.ensureQueryData(statusQueryOptions()),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/status` },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/status` }],
  }),
  component: StatusPage,
});

function StatusPage() {
  const { homeTo, backLabel, loading: authLoading, signedIn, userId } = useAuthNav();
  const scopeUserId = signedIn && userId ? userId : undefined;
  const { data, isLoading, isError } = useQuery({
    ...statusQueryOptions(scopeUserId),
    enabled: !authLoading,
  });
  const monitors = data?.monitors ?? [];
  const failed = isError || (data && !data.ok);
  const loading = authLoading || isLoading;

  return (
    <div className="min-h-screen bg-bg text-zinc-300 font-sans">
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <Link to={homeTo} className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-brand animate-pulse" />
          <span className="text-white font-bold tracking-tight text-xl">UpWatch</span>
        </Link>
        <Link to={homeTo} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
          {backLabel}
        </Link>
      </nav>
      <main className="max-w-5xl mx-auto px-6 pb-24">
        <header className="mb-6">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
            Live system status
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            {signedIn
              ? "Your public monitors on UpWatch."
              : "Public monitors shared by UpWatch users."}
          </p>
        </header>

        <OverallStatusBanner monitors={monitors} incident={data?.incident ?? null} />

        <StatusMonitorList monitors={monitors} loading={loading} failed={!!failed && !loading} />

        <p className="text-xs text-zinc-600 font-mono text-center mt-10">
          Auto-refreshes every 30s · Last updated {new Date().toLocaleTimeString()}
        </p>
      </main>
    </div>
  );
}
