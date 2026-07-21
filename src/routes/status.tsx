import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Live Status — UpWatch" },
      { name: "description", content: "Live infrastructure status for upwatch.online, powered by Uptime Kuma." },
      { property: "og:title", content: "Live Status — UpWatch" },
      { property: "og:description", content: "Real-time uptime and incident history." },
    ],
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
          <p className="text-zinc-400">
            Real-time uptime for every monitored endpoint, streamed from Uptime Kuma.
          </p>
        </header>
        <div className="rounded-2xl border border-brand-border bg-surface overflow-hidden shadow-2xl">
          <iframe
            src="https://status.upwatch.online/status/demo"
            title="UpWatch live status"
            className="w-full h-[85vh] bg-white"
            loading="lazy"
          />
        </div>
      </main>
    </div>
  );
}
