import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL, OG_IMAGE } from "@/lib/site";
import {
  PLAN_FEATURES,
  PLAN_LABEL,
  PLAN_ORDER,
  PLAN_PRICE,
  formatPlanInterval,
  monitorLimitLabel,
} from "@/lib/plans";
import { MarketingLayout } from "@/components/MarketingLayout";

const TITLE = "Features — UpWatch";
const DESC =
  "HTTP uptime checks, multi-region consensus, Slack, Discord and email alerts, public status pages, keyword monitoring, and a real-time admin console.";

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
    h: "Plan-aware cron checks",
    p: "Starter runs every 15 minutes, Pro every 5 minutes, Business every 1 minute — enforced server-side so intervals always match what you paid for.",
  },
  {
    h: "Multi-region consensus",
    p: "Business plan probes from us-east, eu-west and ap-south in parallel. Downtime is only declared when the majority agree.",
  },
  {
    h: "Email, Slack & Discord alerts",
    p: "Starter gets email. Pro adds Slack and Discord webhooks. Business unlocks Telegram and custom webhooks too.",
  },
  {
    h: "Keyword monitoring",
    p: "Watch for a string in the response body — catch blank pages, error banners, or missing content even when HTTP 200 returns.",
  },
  {
    h: "Public status pages",
    p: "Mark monitors public and they appear on upwatch.online/status. Connect Uptime Kuma at status.upwatch.online for a dedicated page.",
  },
  {
    h: "Incident history",
    p: "Every downtime window is logged with start, resolution, response time and error message for postmortems.",
  },
  {
    h: "Support tickets",
    p: "Users open tickets from the dashboard; admins reply in-console with threaded messages and priority levels.",
  },
  {
    h: "Admin console",
    p: "Manage users, plans, monitors, incidents, waitlist, and alert channels from a single admin panel with live stats.",
  },
  {
    h: "SSRF-safe by design",
    p: "The runner blocks probes against private IP ranges so monitors cannot scan your internal network.",
  },
  {
    h: "Browser notification bell",
    p: "In-app alerts when you're logged in — no webhook setup required for quick visibility.",
  },
];

function FeaturesPage() {
  return (
    <MarketingLayout>
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Everything you need to know your site is up.</h1>
        <p className="mt-4 text-lg text-white/70 max-w-3xl">
          UpWatch is a focused uptime monitor — fast checks, honest alerts, and an admin console that scales with you.
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

      <section className="max-w-5xl mx-auto px-6 mt-20 mb-8">
        <h2 className="text-2xl font-bold text-center mb-8">Plans at a glance</h2>
        <div className="overflow-x-auto border border-white/10 rounded-xl">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-white/50 bg-white/[0.03]">
              <tr>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-left px-4 py-3">Price</th>
                <th className="text-left px-4 py-3">Monitors</th>
                <th className="text-left px-4 py-3">Check interval</th>
                <th className="text-left px-4 py-3">Includes</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_ORDER.map((plan) => (
                <tr key={plan} className="border-t border-white/10">
                  <td className="px-4 py-3 font-medium">{PLAN_LABEL[plan]}</td>
                  <td className="px-4 py-3 font-mono">{PLAN_PRICE[plan]}</td>
                  <td className="px-4 py-3">{monitorLimitLabel(plan)}</td>
                  <td className="px-4 py-3 font-mono">{formatPlanInterval(plan)}</td>
                  <td className="px-4 py-3 text-white/70">{PLAN_FEATURES[plan].join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 mt-8 mb-24 flex flex-wrap justify-center gap-4">
        <Link to="/pricing" className="inline-flex rounded-md border border-white/20 px-6 py-3 font-medium hover:bg-white/5">
          View pricing
        </Link>
        <Link to="/auth" className="inline-flex rounded-md bg-[#10b981] px-6 py-3 text-black font-medium hover:bg-[#0ea371]">
          Start monitoring — free
        </Link>
      </section>
    </MarketingLayout>
  );
}
