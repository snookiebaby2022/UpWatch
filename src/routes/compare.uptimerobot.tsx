import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL, OG_IMAGE } from "@/lib/site";
import { ComparePage } from "@/components/ComparePage";

const TITLE = "UpWatch vs UptimeRobot — a friendly comparison";
const DESC =
  "How UpWatch stacks up against UptimeRobot on check interval, multi-region monitoring, alerting channels and pricing.";

export const Route = createFileRoute("/compare/uptimerobot")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/compare/uptimerobot` },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/compare/uptimerobot` }],
  }),
  component: () => (
    <ComparePage
      competitor="UptimeRobot"
      intro="UptimeRobot is one of the oldest names in uptime monitoring. UpWatch is a modern, focused alternative built for developers who want honest checks and alerts without a maze of upsells."
      rows={[
        ["Free plan check interval", "5 minutes", "15 minutes"],
        ["Business check interval", "60 seconds", "60 seconds"],
        ["Multi-region consensus", "1 minute", "Yes (2-of-3)"],
        ["Telegram alerts", "Add-on", "Built-in"],
        ["Public status pages", "Yes", "Yes"],
        ["Starting price", "£0", "£0"],
      ]}
    />
  ),
});
