import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL, OG_IMAGE } from "@/lib/site";
import { MarketingLayout } from "@/components/MarketingLayout";

const TITLE = "Pricing — UpWatch";
const DESC =
  "Simple uptime monitoring pricing. Starter free forever, Pro £10/mo, Business £30/mo with 60-second multi-region checks. No credit card to start.";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/pricing` },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/pricing` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "UpWatch",
          description: DESC,
          brand: { "@type": "Brand", name: "UpWatch" },
          offers: [
            { "@type": "Offer", name: "Starter", price: "0", priceCurrency: "GBP", url: `${SITE_URL}/pricing` },
            { "@type": "Offer", name: "Pro", price: "10", priceCurrency: "GBP", url: `${SITE_URL}/pricing` },
            { "@type": "Offer", name: "Business", price: "30", priceCurrency: "GBP", url: `${SITE_URL}/pricing` },
          ],
        }),
      },
    ],
  }),
  component: PricingPage,
});

const PLANS = [
  {
    name: "Starter",
    price: "£0",
    period: "forever",
    cta: { label: "Start free", to: "/auth" as const, href: null as string | null },
    features: ["5 monitors", "15-minute checks", "Email alerts", "Public status page"],
  },
  {
    name: "Pro",
    price: "£10",
    period: "per month",
    cta: { label: "Upgrade to Pro", to: null, href: "https://buy.stripe.com/14A5kDeEQb1o61s1a2ebu00" },
    features: ["50 monitors", "5-minute checks", "Slack + Discord + Telegram", "Custom status pages"],
    highlight: true,
  },
  {
    name: "Business",
    price: "£30",
    period: "per month",
    cta: { label: "Upgrade to Business", to: null, href: "https://buy.stripe.com/5kQ00j7coedA3Tk5qiebu01" },
    features: ["Unlimited monitors", "60-second multi-region checks", "Priority support", "SLA reports"],
  },
];

function PricingPage() {
  return (
    <MarketingLayout>
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Simple, transparent pricing.</h1>
        <p className="mt-4 text-white/70">Start free. Upgrade when your side project grows up.</p>
      </section>
      <section className="max-w-5xl mx-auto px-6 grid md:grid-cols-3 gap-6 pb-12">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`rounded-xl border p-6 flex flex-col ${
              p.highlight ? "border-[#10b981] bg-[#10b981]/5" : "border-white/10 bg-white/[0.02]"
            }`}
          >
            <h2 className="text-lg font-semibold">{p.name}</h2>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-bold">{p.price}</span>
              <span className="text-white/60 text-sm">/ {p.period}</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-white/80 flex-1">
              {p.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            {p.cta.to ? (
              <Link
                to={p.cta.to}
                className="mt-6 inline-flex justify-center rounded-md bg-[#10b981] px-4 py-2 text-black font-medium hover:bg-[#0ea371]"
              >
                {p.cta.label}
              </Link>
            ) : (
              <a
                href={p.cta.href!}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-6 inline-flex justify-center rounded-md bg-white px-4 py-2 text-black font-medium hover:bg-white/90"
              >
                {p.cta.label}
              </a>
            )}
          </div>
        ))}
      </section>
      <section className="max-w-3xl mx-auto px-6 pb-24 text-sm text-white/60 text-center">
        Prices in GBP. Cancel any time from your Stripe billing portal — no lock-in, no per-seat charges.
      </section>
    </MarketingLayout>
  );
}
