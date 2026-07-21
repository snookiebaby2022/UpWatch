import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getKumaStatus, type KumaMonitor } from "@/lib/kuma.functions";
import { supabase } from "@/integrations/supabase/client";

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

const STRIPE_PRO_URL = "https://buy.stripe.com/14A5kDeEQb1o61s1a2ebu00";
const STRIPE_BUSINESS_URL = "https://buy.stripe.com/5kQ00j7coedA3Tk5qiebu01";

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
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
        Professional uptime monitoring for modern stacks. Instant alerts via Slack, Email, or SMS
        the second your site hiccups.
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
  const { data, isLoading, isError } = useQuery(kumaQueryOptions(getKumaStatus));
  const monitors = data?.monitors ?? [];
  const ok = data?.ok ?? false;
  const failed = isError || (data && !data.ok);

  return (
    <section id="demo" className="max-w-5xl mx-auto px-6 mb-32">
      <div className="bg-surface rounded-2xl border border-brand-border p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-8">
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
          <Link
            to="/status"
            className="text-xs font-mono text-zinc-500 uppercase tracking-widest hover:text-brand transition-colors"
          >
            Live from status.upwatch.online →
          </Link>
        </div>
        <div className="space-y-6">
          {isLoading && (
            <div className="text-sm text-zinc-500 py-8 text-center font-mono">
              Waiting for heartbeats…
            </div>
          )}
          {failed && (
            <div className="text-sm text-zinc-500 py-8 text-center font-mono border border-dashed border-brand-border rounded-xl">
              Couldn't reach the status API. Retrying automatically…
            </div>
          )}
          {!isLoading && !failed && monitors.length === 0 && (
            <div className="text-sm text-zinc-500 py-8 text-center font-mono">
              No monitors reporting right now.
            </div>
          )}
          {monitors.map((m) => (
            <MonitorRow key={m.id} monitor={m} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MonitorRow({ monitor }: { monitor: KumaMonitor }) {
  const beats = monitor.heartbeats.length
    ? monitor.heartbeats
    : Array.from({ length: 20 }, () => ({ status: 0, time: "", msg: "", ping: null }));
  const uptime =
    monitor.uptime != null ? `${(monitor.uptime * 100).toFixed(2)}%` : "—";

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4">
      <div className="w-48">
        <div className="text-white font-medium truncate">{monitor.name}</div>
        <div className="text-xs text-zinc-500 font-mono truncate">
          {monitor.latestPing != null ? `${monitor.latestPing}ms` : "no data"}
        </div>
      </div>
      <div className="flex-1 flex gap-1 h-8 items-end">
        {beats.map((b, i) => {
          const color =
            b.status === 1
              ? "bg-brand/20 border-brand"
              : b.status === 2
                ? "bg-yellow-500/20 border-yellow-500"
                : b.status === 0
                  ? "bg-zinc-800 border-zinc-700"
                  : "bg-red-500/20 border-red-500";
          const h = b.status === 1 ? "h-6" : b.status === 2 ? "h-4" : b.status === 0 ? "h-3" : "h-5";
          return <div key={i} className={`flex-1 rounded-sm border-b-2 ${h} ${color}`} />;
        })}
      </div>
      <div className="text-right w-20">
        <div className="text-brand font-mono text-sm">{uptime}</div>
      </div>
    </div>
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
    price: "£0",
    features: ["5 Monitors", "5-minute intervals", "Email alerts"],
    cta: "Join Free",
    href: "/auth",
  },
  {
    name: "Pro",
    price: "£10",
    features: [
      "50 Monitors",
      "1-minute intervals",
      "Slack & Discord integrations",
      "Custom Status Pages",
    ],
    cta: "Subscribe Now",
    href: STRIPE_PRO_URL,
    popular: true,
  },
  {
    name: "Business",
    price: "£30",
    features: [
      "Unlimited Monitors",
      "30-second intervals",
      "Multi-region checking",
      "White-label reports",
    ],
    cta: "Subscribe Now",
    href: STRIPE_BUSINESS_URL,
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
                target="_blank"
                rel="noopener noreferrer"
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

const FAQS = [
  {
    q: "What happens if my site goes down?",
    a: "The instant a check fails, we retry from a secondary path to confirm it's real — not a network blip. Then we fire alerts through every channel you've enabled: email, Slack, Discord, SMS, or webhook. You get a full trace log, timestamp, and the exact error.",
  },
  {
    q: "How often do you check my endpoints?",
    a: "Every 60 seconds on all plans. Business tier adds 30-second checks for critical infrastructure.",
  },
  {
    q: "Can I host a public status page?",
    a: "Yes — every plan includes a hosted status page at status.yourdomain.com with full SSL. Share it with customers, embed it in your app, or link it from your support docs.",
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
    const { error } = await supabase.from("waitlist").insert({ email: trimmed });
    if (error) {
      setStatus("error");
      setMessage(
        error.code === "23505" ? "You're already on the list." : "Something went wrong. Try again.",
      );
      return;
    }
    setStatus("success");
    setMessage("You're on the list. We'll be in touch.");
    setEmail("");
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
        <div className="flex gap-8 text-sm">
          <Link to="/privacy" className="hover:text-white">Privacy</Link>
          <Link to="/terms" className="hover:text-white">Terms</Link>
          <Link to="/status" className="hover:text-white">Status</Link>
        </div>
        <div className="text-xs text-zinc-600 font-mono">
          © 2024 UPWATCH.ONLINE // STATUS: NOMINAL
        </div>
      </div>
    </footer>
  );
}
