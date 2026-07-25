import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL, OG_IMAGE } from "@/lib/site";

const TITLE = "Privacy Policy — UpWatch";
const DESC = "How UpWatch collects, uses, and protects your data. No third-party analytics, no data selling.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/privacy` },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/privacy` }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="min-h-screen bg-bg text-zinc-300 font-sans">
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-brand animate-pulse" />
          <span className="text-white font-bold tracking-tight text-xl">UpWatch</span>
        </Link>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-12 prose prose-invert">
        <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-zinc-500 text-sm mb-8">Last updated: 25 July 2026</p>
        <div className="space-y-6 text-zinc-400 leading-relaxed">
          <p>
            UpWatch ("we", "our", "us") operates upwatch.online. This policy explains what we
            collect, why, and your rights under UK GDPR.
          </p>
          <h2 className="text-xl font-semibold text-white">What we collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Account data: email address, display name, hashed password (or OAuth identity).</li>
            <li>Monitor data: the URLs and names of endpoints you ask us to check, plus check results.</li>
            <li>Billing metadata: Stripe customer and subscription identifiers (no card details are stored by us).</li>
            <li>Essential cookies: session tokens to keep you signed in (see Cookies below).</li>
          </ul>
          <h2 className="text-xl font-semibold text-white">Subprocessors</h2>
          <p>We use the following providers to operate the service:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Supabase — authentication and database (EU/US)</li>
            <li>Stripe — payment processing</li>
            <li>Cloudflare — hosting and CDN</li>
            <li>Brevo — transactional email alerts</li>
            <li>Telegram — optional alert delivery (Business plan)</li>
          </ul>
          <h2 className="text-xl font-semibold text-white">How we use it</h2>
          <p>
            We use your data only to operate the monitoring service, send alerts and account emails,
            and process payments. We never sell it and never share it with third-party advertisers.
          </p>
          <h2 className="text-xl font-semibold text-white">Cookies</h2>
          <p>
            We use essential cookies only — to maintain your login session and remember cookie consent.
            We do not use advertising or analytics cookies.
          </p>
          <h2 className="text-xl font-semibold text-white">Your rights</h2>
          <p>
            You can delete your account and all associated data from the dashboard (Account section),
            or by emailing hello@upwatch.online. You may also request a copy of your data by email.
          </p>
          <h2 className="text-xl font-semibold text-white">Contact</h2>
          <p>Questions? Email hello@upwatch.online.</p>
        </div>
      </main>
    </div>
  );
}
