import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL, OG_IMAGE } from "@/lib/site";
import { MarketingLayout } from "@/components/MarketingLayout";

const TITLE = "Features — UpWatch";
const DESC =
  "HTTP/HTTPS uptime checks, multi-region consensus, Slack, Discord, Telegram and email alerts, public status pages, and a real-time dashboard.";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/features` },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/features` }],
  }),
  component: FeaturesPage,
});

const FEATURES = [
  {
    h: "Sub-minute HTTP checks",
    p: "Business plan probes every 60 seconds from three regions with 2-of-3 consensus so a single flaky POP never triggers a false alert.",
  },
  {
    h: "Multi-region consensus",
    p: "Checks run in parallel from us-east, eu-west and ap-south. Downtime is only declared when the majority agree, matching what your users actually experience.",
  },
  {
    h: "Instant alerts, five ways",
    p: "Email (Brevo), Slack webhooks, Discord webhooks, Telegram bot messages, and a browser notification bell — all fire the moment a monitor flips state.",
  },
  {
    h: "Public status pages",
    p: "Flip a switch on any monitor to publish it. Visitors get 24-hour uptime, latest ping and live status — no separate config.",
  },
  {
    h: "Incident history",
    p: "Every downtime window is logged with start, resolution, response time and error message so you can build a real postmortem instead of guessing.",
  },
  {
    h: "SSRF-safe by design",
    p: "The runner blocks probes against private IP ranges, so a monitor can never be used to scan your internal network.",
  },
];

function FeaturesPage() {
  return (
    <MarketingLayout>
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Everything you need to know your site is up.</h1>
        <p className="mt-4 text-lg text-white/70 max-w-3xl">
          UpWatch is a focused uptime monitor. No dashboards you'll never open, no invoicing add-ons — just fast, honest checks and alerts that actually reach you.
        </p>
      </section>
      <section className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-6">
        {FEATURES.map((f) => (
          <div key={f.h} className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-lg font-semibold">{f.h}</h2>
            <p className="mt-2 text-sm text-white/70">{f.p}</p>
          </div>
        ))}
      </section>
      <section className="max-w-5xl mx-auto px-6 mt-16 mb-24 text-center">
        <Link to="/auth" className="inline-flex rounded-md bg-[#10b981] px-6 py-3 text-black font-medium hover:bg-[#0ea371]">
          Start monitoring — free
        </Link>
      </section>
    </MarketingLayout>
  );
}
