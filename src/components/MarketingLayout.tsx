import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { BUILD_LABEL } from "@/lib/build";

/**
 * Minimal marketing shell used by SEO content routes (features, pricing,
 * compare, blog). Reuses the site's dark palette established in `index.tsx`.
 */
export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10">
        <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-semibold text-white">
            UpWatch
          </Link>
          <div className="flex items-center gap-6 text-sm text-white/70">
            <Link to="/features" className="hover:text-white">Features</Link>
            <Link to="/pricing" className="hover:text-white">Pricing</Link>
            <Link to="/compare/uptimerobot" className="hover:text-white">Compare</Link>
            <Link to="/support" className="hover:text-white">Support</Link>
            <Link to="/status" className="hover:text-white">Status</Link>
            <Link
              to="/auth"
              className="rounded-md bg-[#10b981] px-3 py-1.5 text-black font-medium hover:bg-[#0ea371]"
            >
              Sign in
            </Link>
          </div>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="border-t border-white/10 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-wrap justify-between text-sm text-white/60 gap-6">
          <div>
            © {new Date().getFullYear()} UpWatch. All rights reserved.
            {BUILD_LABEL !== "local" && (
              <span className="ml-2 text-white/30 font-mono text-xs">build {BUILD_LABEL}</span>
            )}
          </div>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-white">Privacy</Link>
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <a href="https://t.me/upwatchonline" className="hover:text-white">Telegram</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
