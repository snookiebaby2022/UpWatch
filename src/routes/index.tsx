import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { getKumaStatus, type KumaMonitor } from "@/lib/kuma.functions";

const kumaQueryOptions = (fn: typeof getKumaStatus) =>
  queryOptions({
    queryKey: ["kuma-status"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(kumaQueryOptions(getKumaStatus)),
  component: Index,
});

const STRIPE_URL = "https://buy.stripe.com/demo";

function Index() {
  return (
    <div className="min-h-screen bg-bg text-zinc-300 font-sans selection:bg-brand/30">
      <Nav />
      <Hero />
      <LiveDemo />
      <Pricing />
      <Testimonials />
      <FAQ />
      <LeadCapture />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
      <a href="#" className="flex items-center gap-2">
        <div className="size-3 rounded-full bg-brand animate-pulse" />
        <span className="text-white font-bold tracking-tight text-xl">UpWatch</span>
      </a>
      <div className="hidden md:flex gap-8 text-sm font-medium">
        <a href="#demo" className="hover:text-brand transition-colors">Product</a>
        <a href="#demo" className="hover:text-brand transition-colors">Status</a>
        <a href="#pricing" className="hover:text-brand transition-colors">Pricing</a>
      </div>
      <a
        href="#pricing"
        className="bg-white text-black px-4 py-2 rounded-full text-sm font-semibold hover:bg-zinc-200 transition-colors"
      >
        Start Monitoring
      </a>
    </nav>
  );
}

function Hero() {
  return (
    <header className="max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
      <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6">
        Sleep better while
        <br />
        <span className="text-brand">we watch your pings.</span>
      </h1>
      <p className="max-w-2xl mx-auto text-lg text-zinc-400 mb-10">
        Professional uptime monitoring for modern stacks. Instant alerts via Slack, Email, or SMS
        the second your site hiccups. Already watching 1.2M endpoints.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <a
          href={STRIPE_URL}
          className="w-full sm:w-auto bg-brand text-bg px-8 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-transform"
        >
          Get Started — $29/mo
        </a>
        <a
          href="#demo"
          className="w-full sm:w-auto bg-surface border border-brand-border px-8 py-4 rounded-xl font-bold text-lg text-white hover:bg-brand-border transition-colors"
        >
          View Live Demo
        </a>
      </div>
    </header>
  );
}

type MonitorBar = { h: string; color: "brand" | "yellow" };
type Monitor = {
  name: string;
  url: string;
  uptime: string;
  bars: MonitorBar[];
  dimmed?: boolean;
};

const MONITORS: Monitor[] = [
  {
    name: "Main API Gateway",
    url: "api.upwatch.online",
    uptime: "99.98%",
    bars: [
      { h: "h-6", color: "brand" },
      { h: "h-6", color: "brand" },
      { h: "h-6", color: "brand" },
      { h: "h-8", color: "brand" },
      { h: "h-6", color: "brand" },
      { h: "h-4", color: "yellow" },
      { h: "h-6", color: "brand" },
      { h: "h-6", color: "brand" },
    ],
  },
  {
    name: "Global CDN",
    url: "cdn.upwatch.online",
    uptime: "100%",
    dimmed: true,
    bars: Array.from({ length: 8 }, () => ({ h: "h-6", color: "brand" as const })),
  },
];

function LiveDemo() {
  return (
    <section id="demo" className="max-w-5xl mx-auto px-6 mb-32">
      <div className="bg-surface rounded-2xl border border-brand-border p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <span className="text-brand text-xs">●</span> Operational Services
          </h3>
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
            Last checked: Just now
          </span>
        </div>
        <div className="space-y-6">
          {MONITORS.map((m) => (
            <div
              key={m.name}
              className={`flex flex-col md:flex-row md:items-center gap-4 ${m.dimmed ? "opacity-75" : ""}`}
            >
              <div className="w-48">
                <div className="text-white font-medium">{m.name}</div>
                <div className="text-xs text-zinc-500 font-mono">{m.url}</div>
              </div>
              <div className="flex-1 flex gap-1 h-8 items-end">
                {m.bars.map((b, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm border-b-2 ${b.h} ${
                      b.color === "yellow"
                        ? "bg-yellow-500/20 border-yellow-500"
                        : "bg-brand/20 border-brand"
                    }`}
                  />
                ))}
              </div>
              <div className="text-right">
                <div className="text-brand font-mono text-sm">{m.uptime}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type Tier = {
  name: string;
  price: string;
  features: string[];
  cta: string;
  href?: string;
  popular?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Starter",
    price: "$0",
    features: ["5 Monitors", "5-minute intervals", "Email alerts"],
    cta: "Join Free",
  },
  {
    name: "Pro",
    price: "$29",
    features: [
      "50 Monitors",
      "1-minute intervals",
      "Slack & Discord integrations",
      "Custom Status Pages",
    ],
    cta: "Subscribe Now",
    href: STRIPE_URL,
    popular: true,
  },
  {
    name: "Business",
    price: "$99",
    features: [
      "Unlimited Monitors",
      "30-second intervals",
      "Multi-region checking",
      "White-label reports",
    ],
    cta: "Contact Sales",
  },
];

function Pricing() {
  return (
    <section id="pricing" className="max-w-7xl mx-auto px-6 mb-32">
      <div className="text-center mb-16">
        <h2 className="text-3xl font-bold text-white mb-4">Simple, transparent pricing</h2>
        <p className="text-zinc-400">No hidden fees. Scale as you grow.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`bg-surface p-8 rounded-2xl flex flex-col relative ${
              tier.popular ? "border-2 border-brand" : "border border-brand-border"
            }`}
          >
            {tier.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand text-bg px-4 py-1 rounded-full text-xs font-bold">
                POPULAR
              </div>
            )}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
              <div className="text-4xl font-bold text-white">
                {tier.price}
                <span className="text-lg text-zinc-500 font-normal">/mo</span>
              </div>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              {tier.features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm">
                  <span className="text-brand">✓</span> {f}
                </li>
              ))}
            </ul>
            {tier.href ? (
              <a
                href={tier.href}
                className="w-full py-3 rounded-lg bg-brand text-bg text-center font-bold hover:opacity-90 transition-opacity"
              >
                {tier.cta}
              </a>
            ) : (
              <button
                type="button"
                className="w-full py-3 rounded-lg border border-brand-border text-white font-semibold hover:bg-brand-border transition-colors"
              >
                {tier.cta}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

const TESTIMONIALS = [
  {
    quote:
      "UpWatch caught a database leak 15 minutes before our users did. It literally saved our launch day.",
    name: "Sarah Jenkins",
    role: "CTO at DataFlow",
  },
  {
    quote:
      "Setting up Uptime Kuma was a pain until I found this hosted version. Best $29 I spend every month.",
    name: "Marcus Thorne",
    role: "Independent Developer",
  },
];

function Testimonials() {
  return (
    <section className="max-w-7xl mx-auto px-6 mb-32">
      <div className="grid md:grid-cols-2 gap-6">
        {TESTIMONIALS.map((t) => (
          <div key={t.name} className="p-8 rounded-2xl bg-zinc-900/50 border border-brand-border">
            <p className="text-lg italic text-zinc-300 mb-6">"{t.quote}"</p>
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-full bg-zinc-700" />
              <div>
                <div className="text-white font-bold">{t.name}</div>
                <div className="text-xs text-zinc-500">{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "What happens if my site goes down?",
    a: "The instant a check fails, UpWatch fires alerts through every channel you've enabled — Slack, Discord, Email, SMS, or webhook — with a full trace log of the failure and the region that detected it.",
  },
  {
    q: "How often do you check my endpoints?",
    a: "From every 5 minutes on the Starter plan down to every 30 seconds on Business, across multiple global regions simultaneously to eliminate false positives.",
  },
  {
    q: "Can I host a public status page?",
    a: "Yes. Pro and Business plans include hosted status pages that you can map to your own custom domain with full SSL.",
  },
  {
    q: "Do you integrate with Uptime Kuma?",
    a: "UpWatch works alongside self-hosted tools and can pull status via the Uptime Kuma API if you want a hybrid setup.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Subscriptions are month-to-month, no contracts. Cancel from your dashboard and you keep access until the end of the billing period.",
  },
];

function FAQ() {
  return (
    <section className="max-w-3xl mx-auto px-6 mb-32">
      <h2 className="text-3xl font-bold text-white mb-12 text-center">Common questions</h2>
      <div className="space-y-3">
        {FAQS.map((item) => (
          <details
            key={item.q}
            className="group bg-surface border border-brand-border rounded-xl px-6 py-4"
          >
            <summary className="cursor-pointer list-none flex items-center justify-between text-white font-semibold">
              {item.q}
              <span className="text-brand text-xl transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-4 text-zinc-400 text-sm leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function LeadCapture() {
  return (
    <section className="max-w-3xl mx-auto px-6 pb-32">
      <div className="bg-brand rounded-3xl p-12 text-center text-bg">
        <h2 className="text-3xl font-bold mb-4">Ready to stop worrying?</h2>
        <p className="mb-8 font-medium">Join 5,000+ developers monitoring their sites with UpWatch.</p>
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            required
            placeholder="your@email.com"
            className="flex-1 px-6 py-4 rounded-xl bg-white/20 border-none placeholder:text-bg/60 text-bg focus:ring-2 focus:ring-bg/20 outline-none"
          />
          <button
            type="submit"
            className="bg-bg text-brand px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-xl"
          >
            Notify Me
          </button>
        </form>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-brand-border py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-brand" />
          <span className="text-white font-bold">UpWatch</span>
        </div>
        <div className="flex gap-8 text-sm">
          <a href="#" className="hover:text-white">Privacy</a>
          <a href="#" className="hover:text-white">Terms</a>
          <a href="#" className="hover:text-white">API Docs</a>
        </div>
        <div className="text-xs text-zinc-600 font-mono">
          © 2024 UPWATCH.ONLINE // STATUS: NOMINAL
        </div>
      </div>
    </footer>
  );
}
