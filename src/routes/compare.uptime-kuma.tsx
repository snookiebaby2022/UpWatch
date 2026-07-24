import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL, OG_IMAGE } from "@/lib/site";
import { ComparePage } from "@/components/ComparePage";

const TITLE = "UpWatch vs Uptime Kuma — hosted vs self-hosted";
const DESC =
  "Comparing UpWatch's hosted uptime monitoring to running Uptime Kuma yourself: setup, alerts, multi-region and total cost of ownership.";

export const Route = createFileRoute("/compare/uptime-kuma")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/compare/uptime-kuma` },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/compare/uptime-kuma` }],
  }),
  component: () => (
    <ComparePage
      competitor="Uptime Kuma"
      intro="Uptime Kuma is an excellent open-source uptime monitor — but you own the server, the updates, and the outages. UpWatch is the hosted alternative for teams who want the results without babysitting infrastructure."
      rows={[
        ["Setup time", "Minutes (hosted)", "Docker + reverse proxy"],
        ["Multi-region checks", "Built-in", "Manual — run multiple nodes"],
        ["Upgrades & patches", "Automatic", "Your responsibility"],
        ["Alert channels", "Email, Slack, Discord, Telegram", "Many, self-configured"],
        ["Public status pages", "One-click", "Yes"],
        ["Where downtime notices arrive when your server is down", "Externally hosted", "Depends on where Kuma runs"],
      ]}
    />
  ),
});
