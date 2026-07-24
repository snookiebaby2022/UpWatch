import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { SITE_URL, OG_IMAGE } from "@/lib/site";
import { getPublicStatus } from "@/lib/status.functions";
import {
  OverallStatusBanner,
  StatusMonitorList,
  StatusPageLinks,
  StatusSourceBadge,
} from "@/components/StatusMonitorList";

const TITLE = "Live System Status — UpWatch";
const DESC =
  "Real-time uptime for UpWatch and public monitors. Powered by Uptime Kuma when configured, otherwise UpWatch's own monitoring engine.";

const statusQueryOptions = queryOptions({
  queryKey: ["public-status"],
  queryFn: () => getPublicStatus(),
  refetchInterval: 30_000,
  staleTime: 15_000,
});

export const Route = createFileRoute("/status")({
  loader: ({ context }) => context.queryClient.ensureQueryData(statusQueryOptions),
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
  const { data, isLoading, isError } = useQuery(statusQueryOptions);
  const monitors = data?.monitors ?? [];
  const ok = data?.ok ?? false;
  const failed = isError || (data && !data.ok);

  return (
    <div className="min-h-screen bg-bg text-zinc-300 font-sans">
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-brand animate-pulse" />
          <span className="text-white font-bold tracking-tight text-xl">UpWatch</span>
        </Link>
        <Link to="/" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
          ← Back to home
        </Link>
      </nav>
      <main className="max-w-5xl mx-auto px-6 pb-24">
        <header className="mb-6">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
            Live system status
          </h1>
          <p className="text-zinc-400 max-w-2xl">{DESC}</p>
          {data && (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <StatusSourceBadge source={data.source} />
              <StatusPageLinks source={data.source} kumaPublicUrl={data.kumaPublicUrl} />
            </div>
          )}
        </header>

        <OverallStatusBanner monitors={monitors} incident={data?.incident ?? null} />

        <StatusMonitorList
          monitors={monitors}
          loading={isLoading}
          failed={!!failed && !isLoading}
        />

        <p className="text-xs text-zinc-600 font-mono text-center mt-10">
          Auto-refreshes every 30s · Last updated {new Date().toLocaleTimeString()}
          {ok && data?.source === "kuma" && data.kumaPublicUrl && (
            <>
              {" "}
              ·{" "}
              <a href={data.kumaPublicUrl} className="hover:text-brand" target="_blank" rel="noopener noreferrer">
                Open Uptime Kuma page
              </a>
            </>
          )}
        </p>
      </main>
    </div>
  );
}
