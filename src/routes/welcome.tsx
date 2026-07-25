import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SITE_URL } from "@/lib/site";

const TITLE = "Welcome to UpWatch";
const DESC = "Enter UpWatch — the quiet, always-on eye on your websites.";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/welcome` },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/welcome` }],

  }),
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("upwatch:welcomed", "1");
      sessionStorage.setItem("upwatch:welcomed", "1");
    }
    const timers = [
      setTimeout(() => setPhase(1), 250),
      setTimeout(() => setPhase(2), 1100),
      setTimeout(() => setPhase(3), 1900),
      setTimeout(() => setPhase(4), 2600),
      setTimeout(() => navigate({ to: "/", replace: true }), 3200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [navigate]);

  function skip() {
    if (typeof window !== "undefined") {
      localStorage.setItem("upwatch:welcomed", "1");
      sessionStorage.setItem("upwatch:welcomed", "1");
    }
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-zinc-200 font-sans flex items-center justify-center px-6">
      {/* animated grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(16,185,129,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.08) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse at center, #000 0%, #000 40%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, #000 0%, #000 40%, transparent 75%)",
        }}
      />

      {/* radial glow */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[900px] rounded-full blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(circle, #10b981 0%, rgba(16,185,129,0.15) 40%, transparent 70%)",
        }}
      />

      {/* pulse rings */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/40"
            style={{
              width: 120,
              height: 120,
              animation: `upwatch-ping 3s cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 0.8}s infinite`,
            }}
          />
        ))}
      </div>

      {/* content */}
      <div className="relative z-10 max-w-2xl text-center">
        {/* logo */}
        <div
          className={`inline-flex items-center gap-3 mb-10 transition-all duration-700 ${
            phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
          }`}
        >
          <span className="relative inline-flex">
            <span className="absolute inset-0 rounded-full bg-brand/60 blur-md animate-pulse" />
            <span className="relative size-3 rounded-full bg-brand" />
          </span>
          <span className="font-bold text-white tracking-tight text-2xl">UpWatch</span>
        </div>

        {/* headline */}
        <h1
          className={`text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.05] transition-all duration-700 ${
            phase >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          The web never
          <br />
          <span className="bg-gradient-to-r from-brand via-emerald-300 to-brand bg-clip-text text-transparent">
            stops.
          </span>{" "}
          <span className="text-zinc-500">Neither do we.</span>
        </h1>

        {/* tagline */}
        <p
          className={`mt-6 text-lg text-zinc-400 max-w-lg mx-auto transition-all duration-700 delay-100 ${
            phase >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          Sub-minute uptime checks from every region. Silent when things are fine —
          loud the instant they aren&apos;t.
        </p>

        {/* status pills */}
        <div
          className={`mt-8 flex flex-wrap justify-center gap-2 text-xs font-mono transition-all duration-700 delay-200 ${
            phase >= 3 ? "opacity-100" : "opacity-0"
          }`}
        >
          {["EU-WEST", "US-EAST", "AP-SOUTH"].map((r, i) => (
            <span
              key={r}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-border bg-surface/60 backdrop-blur"
            >
              <span
                className="size-1.5 rounded-full bg-brand"
                style={{ animation: `upwatch-blink 1.4s ${i * 0.35}s infinite` }}
              />
              <span className="uppercase tracking-widest text-zinc-400">{r}</span>
              <span className="text-brand">OK</span>
            </span>
          ))}
        </div>

        {/* CTA */}
        <div
          className={`mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 transition-all duration-700 delay-300 ${
            phase >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <Link
            to="/"
            className="group relative w-full sm:w-auto bg-brand text-bg px-10 py-4 rounded-xl font-bold text-lg hover:scale-[1.03] transition-transform shadow-[0_0_40px_-8px_rgba(16,185,129,0.6)]"
          >
            <span className="relative z-10">Enter UpWatch →</span>
            <span
              aria-hidden
              className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400 to-brand opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="w-full sm:w-auto px-8 py-4 rounded-xl border border-brand-border bg-surface/50 backdrop-blur text-white font-semibold hover:border-brand transition-colors"
          >
            Create account
          </Link>
        </div>

        <button
          type="button"
          onClick={skip}
          className={`mt-8 text-sm text-zinc-500 hover:text-brand transition-colors ${
            phase >= 2 ? "opacity-100" : "opacity-0"
          }`}
        >
          Skip intro →
        </button>

        {/* footer meta */}
        <div
          className={`mt-16 text-xs font-mono text-zinc-600 uppercase tracking-widest transition-opacity duration-700 delay-500 ${
            phase >= 4 ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <span className="size-1 rounded-full bg-brand animate-pulse" />
            All systems operational · v1.0
          </span>
        </div>
      </div>

      <style>{`
        @keyframes upwatch-ping {
          0%   { width: 120px; height: 120px; opacity: 0.9; }
          100% { width: 900px; height: 900px; opacity: 0; }
        }
        @keyframes upwatch-blink {
          0%, 60%, 100% { opacity: 1; }
          70%, 90%      { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
