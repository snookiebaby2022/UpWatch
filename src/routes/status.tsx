import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL, OG_IMAGE } from "@/lib/site";

const TITLE = "Live System Status — UpWatch";
const DESC =
  "Real-time uptime for every UpWatch endpoint. Public incident history, response times, and current health for our monitoring infrastructure.";

export const Route = createFileRoute("/status")({
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
  return (
    <div className="min-h-screen bg-bg text-zinc-300 font-sans">
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-brand animate-pulse" />
          <span className="text-white font-bold tracking-tight text-xl">UpWatch</span>
        </Link>
        <Link
          to="/"
          className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
        >
          ← Back to home
        </Link>
      </nav>
      <main className="max-w-6xl mx-auto px-6 pb-24">
        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
            Live system status
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            Real-time uptime for every monitored UpWatch endpoint. This page auto-refreshes and
            includes a rolling 90-day incident history, current response times, and any active
            maintenance windows.
          </p>
        </header>
        <div className="rounded-2xl border border-brand-border bg-surface overflow-hidden shadow-2xl">
          <iframe
            src="https://status.upwatch.online/status/demo"
            title="UpWatch live status"
            className="w-full h-[85vh] bg-white"
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      </main>
    </div>
  );
}
