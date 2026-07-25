import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL, OG_IMAGE } from "@/lib/site";
import { ComparePage } from "@/components/ComparePage";

const TITLE = "UpWatch vs Better Stack — simpler uptime monitoring";
const DESC =
  "How UpWatch compares to Better Stack (Better Uptime) on pricing, check interval, alerts and status pages.";

export const Route = createFileRoute("/compare/betterstack")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/compare/betterstack` },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/compare/betterstack` }],
  }),
  component: () => (
    <ComparePage
      competitor="Better Stack"
      intro="Better Stack (formerly Better Uptime) bundles uptime, logs and incident management. If you only need uptime monitoring, UpWatch is a focused, cheaper option."
      rows={[
        ["Uptime-only pricing", "£0 – £30/mo", "Bundled with logs"],
        ["Business check interval", "60 seconds", "30 seconds"],
        ["Triple-probe consensus (Business)", "Yes (2-of-3 parallel)", "Yes"],
        ["Telegram alerts", "Built-in", "Add-on"],
        ["Public status pages", "One-click", "Yes"],
        ["Ideal for", "Sites, APIs, side projects", "Larger ops teams"],
      ]}
    />
  ),
});
