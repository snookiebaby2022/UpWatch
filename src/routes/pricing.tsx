import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL, OG_IMAGE } from "@/lib/site";
import {
  PLAN_FEATURES,
  PLAN_LABEL,
  PLAN_ORDER,
  PLAN_PRICE,
} from "@/lib/plans";
import { MarketingLayout } from "@/components/MarketingLayout";

const TITLE = "Pricing — UpWatch";
const DESC =
  "Simple uptime monitoring pricing. Starter free forever, Pro £10/mo, Business £30/mo with 1-minute triple-probe checks. No credit card to start.";

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
  { label: string; period: string; highlight?: boolean }
> = {
  starter: { label: "Start free", period: "forever" },
  pro: { label: "Sign up to upgrade", period: "per month", highlight: true },
  business: { label: "Sign up to upgrade", period: "per month" },
};

function PricingPage() {
  return (
    <MarketingLayout>
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Simple, transparent pricing.</h1>
        <p className="mt-4 text-white/70">Start free. Upgrade from your dashboard when you need more.</p>
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
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className={`mt-6 inline-flex justify-center rounded-md px-4 py-2 font-medium ${
                  cta.highlight
                    ? "bg-[#10b981] text-black hover:bg-[#0ea371]"
                    : "bg-white text-black hover:bg-white/90"
                }`}
              >
                {cta.label}
              </Link>
            </div>
          );
        })}
      </section>
      <section className="max-w-3xl mx-auto px-6 pb-24 text-sm text-white/60 text-center">
        Prices in GBP. Paid plans are billed via Stripe. Cancel or update payment any time from the billing portal in your dashboard.
      </section>
    </MarketingLayout>
  );
}
