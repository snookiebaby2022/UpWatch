import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getPublicStatus } from "@/lib/status.functions";
import { STATUS_PAGE_URL, SITE_URL, OG_IMAGE } from "@/lib/site";
import { PLAN_FEATURES, PLAN_LABEL, PLAN_ORDER, PLAN_PRICE } from "@/lib/plans";
import { StatusMonitorList, StatusSourceBadge } from "@/components/StatusMonitorList";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

const statusQueryOptions = queryOptions({
  queryKey: ["public-status"],
  queryFn: () => getPublicStatus(),
  refetchInterval: 30_000,
  staleTime: 15_000,
});
const HOME_TITLE = "UpWatch — Website Uptime Monitoring That Doesn't Sleep";
const HOME_DESC =
  "Monitor your websites and APIs from every region. Starter includes email alerts; Pro adds Slack and Discord. From £0/mo.";

const FAQS = [
  {
    q: "What happens if my site goes down?",
    a: "The instant a check fails, we confirm it is real — not a network blip. Then we alert you on the channels your plan includes: email on Starter, plus Slack and Discord on Pro, and all channels on Business.",
  },
  {
    q: "How often do you check my endpoints?",
    a: "Every 15 minutes on Starter, every 5 minutes on Pro, and every 1 minute on Business for critical infrastructure.",
  },
  {
    q: "Can I host a public status page?",
    a: "Yes — every plan includes a public status page at upwatch.online/status. Mark monitors as public in your dashboard and they appear automatically. Connect Uptime Kuma at status.upwatch.online for a dedicated Kuma status page.",
  },
  {
    q: "Is my data secure?",
    a: "Your monitoring data never leaves our infrastructure. We don't use third-party analytics, don't sell your data, and encrypt all traffic end-to-end.",
  },
  {
    q: "What if I outgrow the starter plan?",
    a: "Upgrade anytime — no migration needed, no downtime. Same monitors, same history, just more features.",
  },
  {
    q: "Can I monitor APIs, not just websites?",
    a: "Absolutely. We check HTTP/HTTPS endpoints, TCP ports, ping, DNS resolution, and keyword presence on any page.",
  },
];

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(statusQueryOptions),
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "UpWatch",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web",
          description: HOME_DESC,
          url: `${SITE_URL}/`,
          image: OG_IMAGE,
          offers: [
            { "@type": "Offer", name: "Starter", price: "0", priceCurrency: "GBP" },
            { "@type": "Offer", name: "Pro", price: "10", priceCurrency: "GBP" },
            { "@type": "Offer", name: "Business", price: "30", priceCurrency: "GBP" },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: Index,
  errorComponent: HomeError,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-bg text-zinc-300 px-6 text-center">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Not found</h1>
        <p className="text-sm text-zinc-400 mb-6">This page doesn't exist.</p>
        <Link to="/" className="bg-brand text-bg px-4 py-2 rounded-md font-semibold">Go home</Link>
      </div>
    </div>
  ),
});

function HomeError({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[/] loader error", error);
  return (
    <div className="min-h-screen bg-bg text-zinc-300 font-sans">
      <Nav />
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-bold text-white mb-3">We're having trouble loading UpWatch</h1>
        <p className="text-sm text-zinc-400 mb-6">{error.message || "Please try again in a moment."}</p>
        <button
          onClick={reset}
          className="bg-brand text-bg px-5 py-3 rounded-lg font-semibold hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

const STRIPE_PRO_URL = "https://buy.stripe.com/14A5kDeEQb1o61s1a2ebu00";
const STRIPE_BUSINESS_URL = "https://buy.stripe.com/5kQ00j7coedA3Tk5qiebu01";

function Index() {
  const navigate = useNavigate();
  // Read sessionStorage AFTER hydration only — reading it during initial
  // render diverges between server (always false) and client (true for
  // first-time visitors), triggering a React hydration mismatch warning
  // and re-render. Deferring to useEffect keeps SSR output stable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("upwatch:welcomed") !== "1") {
      navigate({ to: "/welcome", replace: true });
    }
  }, [navigate]);



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
  const signedIn = useSession();



  return (
    <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
      <Link to="/" className="flex items-center gap-2">
        <div className="size-3 rounded-full bg-brand animate-pulse" />
        <span className="text-white font-bold tracking-tight text-xl">UpWatch</span>
      </Link>
      <div className="hidden md:flex gap-8 text-sm font-medium">
        <a href="#demo" className="hover:text-brand transition-colors">Product</a>
        <Link to="/status" className="hover:text-brand transition-colors">Status</Link>
        <a href="#pricing" className="hover:text-brand transition-colors">Pricing</a>
      </div>
      <div className="flex items-center gap-3 min-h-[40px]">
        {signedIn === null ? (
          <div className="h-9 w-24 rounded-full bg-surface animate-pulse" />
        ) : signedIn ? (
          <Link
            to="/dashboard"
            className="bg-white text-black px-4 py-2 rounded-full text-sm font-semibold hover:bg-zinc-200 transition-colors"
          >
            Dashboard
          </Link>
        ) : (
          <>
            <Link
              to="/auth"
              className="text-sm font-medium text-zinc-300 hover:text-white transition-colors px-3 py-2"
            >
              Log in
            </Link>
            <Link
              to="/auth"
              className="bg-white text-black px-4 py-2 rounded-full text-sm font-semibold hover:bg-zinc-200 transition-colors"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <header className="max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
      <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6">
        Sleep better while
        <br />
        <span className="text-brand">we watch your website.</span>
      </h1>
      <p className="max-w-2xl mx-auto text-lg text-zinc-400 mb-10">
        Professional uptime monitoring for modern stacks. Email alerts on Starter — Slack and Discord on Pro.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          to="/auth"
          className="w-full sm:w-auto bg-brand text-bg px-8 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-transform"
        >
          Get Started — Free
        </Link>
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

function LiveDemo() {
  const { data, isLoading, isError } = useQuery(statusQueryOptions);
  const monitors = data?.monitors ?? [];
  const ok = data?.ok ?? false;
  const failed = isError || (data && !data.ok);

  return (
    <section id="demo" className="max-w-5xl mx-auto px-6 mb-32">
      <div className="bg-surface rounded-2xl border border-brand-border p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <span
              className={`text-xs ${
                ok ? "text-brand" : failed ? "text-red-500" : "text-yellow-500"
              }`}
            >
              ●
            </span>
            {ok
              ? "Operational Services"
              : failed
                ? "Live status temporarily unavailable"
                : "Fetching live status…"}
          </h3>
          <div className="flex flex-col items-end gap-1">
            {data && <StatusSourceBadge source={data.source} />}
            <Link
              to="/status"
              className="text-xs font-mono text-zinc-500 uppercase tracking-widest hover:text-brand transition-colors"
            >
              Live status → {STATUS_PAGE_URL.replace("https://", "")}
            </Link>
          </div>
        </div>
        <StatusMonitorList monitors={monitors} loading={isLoading} failed={!!failed} compact />
      </div>
    </section>
  );
}

type Tier = {
  name: string;
  price: string;
  features: readonly string[];
  cta: string;
  href?: string;
  popular?: boolean;
};

const TIERS: Tier[] = PLAN_ORDER.map((plan) => ({
  name: PLAN_LABEL[plan],
  price: PLAN_PRICE[plan],
  features: PLAN_FEATURES[plan],
  cta: plan === "starter" ? "Join Free" : "Subscribe Now",
  href: plan === "starter" ? "/auth" : plan === "pro" ? STRIPE_PRO_URL : STRIPE_BUSINESS_URL,
  popular: plan === "pro",
}));

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
              tier.href.startsWith("/") ? (
                <Link
                  to={tier.href}
                  className="w-full py-3 rounded-lg bg-brand text-bg text-center font-bold hover:opacity-90 transition-opacity"
                >
                  {tier.cta}
                </Link>
              ) : (
                <a
                  href={tier.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-lg bg-brand text-bg text-center font-bold hover:opacity-90 transition-opacity"
                >
                  {tier.cta}
                </a>
              )
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
      "Alerts land in Slack within seconds of an incident. The retry-from-a-second-region logic has killed every false positive we used to chase.",
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
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Please enter a valid email.");
      return;
    }
    setStatus("loading");
    try {
      const { error } = await supabase.from("waitlist").insert({ email: trimmed });
      // Return a generic success message regardless of duplicate-key errors —
      // returning "already on the list" would expose which emails are enrolled
      // (email enumeration). Log the real error server-side only.
      if (error && error.code !== "23505") {
        console.error("waitlist insert failed", error);
        setStatus("error");
        setMessage("Something went wrong. Try again.");
        return;
      }
      setStatus("success");
      setMessage("You're on the list. We'll be in touch.");
      setEmail("");
    } catch (err) {
      // Network failure, offline, DNS, etc. — supabase-js throws before we
      // get a structured error object. Fail closed with a user-safe message.
      console.error("waitlist insert threw", err);
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }


  return (
    <section className="max-w-3xl mx-auto px-6 pb-32">
      <div className="bg-brand rounded-3xl p-12 text-center text-bg">
        <h2 className="text-3xl font-bold mb-4">Ready to stop worrying?</h2>
        <p className="mb-8 font-medium">
          Drop your email and we'll ping you with product updates and early-access invites.
        </p>
        <form className="flex flex-col sm:flex-row gap-2" onSubmit={handleSubmit}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "loading"}
            placeholder="your@email.com"
            className="flex-1 px-6 py-4 rounded-xl bg-white/20 border-none placeholder:text-bg/60 text-bg focus:ring-2 focus:ring-bg/20 outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="bg-bg text-brand px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-xl disabled:opacity-60 disabled:hover:scale-100"
          >
            {status === "loading" ? "Sending…" : "Notify Me"}
          </button>
        </form>
        {message && (
          <p className={`mt-4 text-sm font-medium ${status === "error" ? "text-red-900" : "text-bg/80"}`}>
            {message}
          </p>
        )}
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
        <div className="flex gap-8 text-sm items-center">
          <Link to="/privacy" className="hover:text-white">Privacy</Link>
          <Link to="/terms" className="hover:text-white">Terms</Link>
          <Link to="/status" className="hover:text-white">Status</Link>
          <a
            href="https://t.me/upwatchonline"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white inline-flex items-center gap-1.5"
            aria-label="Telegram @upwatchonline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.566-4.458c.538-.196 1.006.128.832.949z"/></svg>
            @upwatchonline
          </a>
        </div>

        <div className="text-xs text-zinc-600 font-mono">
          © {new Date().getFullYear()} UPWATCH.ONLINE // STATUS: NOMINAL
        </div>

      </div>
    </footer>
  );
}
