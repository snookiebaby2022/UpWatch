import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL, OG_IMAGE } from "@/lib/site";
import {
  PLAN_FEATURES,
  PLAN_LABEL,
  PLAN_ORDER,
  PLAN_PRICE,
} from "@/lib/plans";
import { MarketingLayout } from "@/components/MarketingLayout";

const STRIPE_PRO_URL = "https://buy.stripe.com/14A5kDeEQb1o61s1a2ebu00";
const STRIPE_BUSINESS_URL = "https://buy.stripe.com/5kQ00j7coedA3Tk5qiebu01";

const TITLE = "Pricing — UpWatch";
const DESC =
  "Simple uptime monitoring pricing. Starter free forever, Pro £10/mo, Business £30/mo with 1-minute multi-region checks. No credit card to start.";

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
          offers: PLAN_ORDER.map((plan) => ({
            "@type": "Offer",
            name: PLAN_LABEL[plan],
            price: plan === "starter" ? "0" : plan === "pro" ? "10" : "30",
            priceCurrency: "GBP",
            url: `${SITE_URL}/pricing`,
          })),
        }),
      },
    ],
  }),
  component: PricingPage,
});

const PLAN_CTA: Record<
  (typeof PLAN_ORDER)[number],
  { label: string; to: "/auth" | null; href: string | null; period: string; highlight?: boolean }
> = {
  starter: { label: "Start free", to: "/auth", href: null, period: "forever" },
  pro: { label: "Upgrade to Pro", to: null, href: STRIPE_PRO_URL, period: "per month", highlight: true },
  business: { label: "Upgrade to Business", to: null, href: STRIPE_BUSINESS_URL, period: "per month" },
};

function PricingPage() {
  return (
    <MarketingLayout>
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Simple, transparent pricing.</h1>
        <p className="mt-4 text-white/70">Start free. Upgrade when your side project grows up.</p>
      </section>
      <section className="max-w-5xl mx-auto px-6 grid md:grid-cols-3 gap-6 pb-12">
        {PLAN_ORDER.map((plan) => {
          const cta = PLAN_CTA[plan];
          return (
            <div
              key={plan}
              className={`rounded-xl border p-6 flex flex-col ${
                cta.highlight ? "border-[#10b981] bg-[#10b981]/5" : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <h2 className="text-lg font-semibold">{PLAN_LABEL[plan]}</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{PLAN_PRICE[plan]}</span>
                <span className="text-white/60 text-sm">/ {cta.period}</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-white/80 flex-1">
                {PLAN_FEATURES[plan].map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              {cta.to ? (
                <Link
                  to={cta.to}
                  className="mt-6 inline-flex justify-center rounded-md bg-[#10b981] px-4 py-2 text-black font-medium hover:bg-[#0ea371]"
                >
                  {cta.label}
                </Link>
              ) : (
                <a
                  href={cta.href!}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-6 inline-flex justify-center rounded-md bg-white px-4 py-2 text-black font-medium hover:bg-white/90"
                >
                  {cta.label}
                </a>
              )}
            </div>
          );
        })}
      </section>
      <section className="max-w-3xl mx-auto px-6 pb-24 text-sm text-white/60 text-center">
        Prices in GBP. Cancel any time from your Stripe billing portal — no lock-in, no per-seat charges.
      </section>
    </MarketingLayout>
  );
}
