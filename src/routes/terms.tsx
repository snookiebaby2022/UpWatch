import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — UpWatch" },
      { name: "description", content: "The terms governing use of UpWatch monitoring." },
      { property: "og:title", content: "Terms of Service — UpWatch" },
      { property: "og:description", content: "The terms governing use of UpWatch monitoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <div className="min-h-screen bg-bg text-zinc-300 font-sans">
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-brand animate-pulse" />
          <span className="text-white font-bold tracking-tight text-xl">UpWatch</span>
        </Link>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-zinc-500 text-sm mb-8">Last updated: 21 July 2026</p>
        <div className="space-y-6 text-zinc-400 leading-relaxed">
          <h2 className="text-xl font-semibold text-white">1. Service</h2>
          <p>
            UpWatch provides HTTP, TCP, ping, DNS and keyword uptime monitoring. We use commercially
            reasonable efforts to keep the service available but do not guarantee uninterrupted access.
          </p>
          <h2 className="text-xl font-semibold text-white">2. Acceptable use</h2>
          <p>
            You may only monitor endpoints you own or are authorised to check. You must not use the
            service to attack, load-test, or scan third-party systems.
          </p>
          <h2 className="text-xl font-semibold text-white">3. Billing</h2>
          <p>
            Paid plans are billed monthly via Stripe. Cancel any time from your dashboard —
            cancellation takes effect at the end of the current billing period; we don't refund partial months.
          </p>
          <h2 className="text-xl font-semibold text-white">4. Liability</h2>
          <p>
            The service is provided "as is". We are not liable for indirect or consequential losses
            arising from missed alerts, false positives, or downtime of the monitoring service itself.
          </p>
          <h2 className="text-xl font-semibold text-white">5. Contact</h2>
          <p>Questions about these terms? Email hello@upwatch.online.</p>
        </div>
      </main>
    </div>
  );
}
