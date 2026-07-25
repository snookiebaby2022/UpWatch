import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const STORAGE_KEY = "upwatch:cookie-consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function accept() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed bottom-0 inset-x-0 z-50 p-4 md:p-6"
    >
      <div className="max-w-3xl mx-auto rounded-xl border border-brand-border bg-surface/95 backdrop-blur px-5 py-4 shadow-2xl flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-sm text-zinc-400 leading-relaxed flex-1">
          We use essential cookies to keep you signed in and remember your preferences.
          No advertising or third-party analytics. See our{" "}
          <Link to="/privacy" className="text-brand hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 bg-brand text-bg font-semibold px-5 py-2.5 rounded-lg text-sm hover:opacity-90"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
