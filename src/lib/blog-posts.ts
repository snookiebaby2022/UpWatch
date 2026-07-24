export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  datePublished: string; // ISO date
  author: string;
  readingMinutes: number;
  body: string; // markdown-ish plain text, rendered as paragraphs split on blank lines
}

export const POSTS: BlogPost[] = [
  {
    slug: "how-to-monitor-a-website-for-free",
    title: "How to monitor a website for free in 2026",
    description:
      "A practical walkthrough of setting up free uptime monitoring for a website or API, without giving up alerting or a status page.",
    datePublished: "2026-01-14",
    author: "UpWatch Team",
    readingMinutes: 5,
    body: `Uptime monitoring used to mean either paying £50/mo or self-hosting a service on the same server you were trying to watch. Neither is a good idea in 2026.

The essentials of free monitoring.
You need three things: an external prober that hits your URL on a schedule, a rule that decides when something is broken, and an alert channel that actually gets your attention. Anything else is a nice-to-have.

Set a realistic check interval.
Free tiers usually check every 5–15 minutes. That's plenty for a marketing site or side project. Save the 60-second checks for revenue-generating APIs where every extra minute of downtime costs money.

Alerts must land where you already look.
An email alert at 2am helps no one. Wire your monitor into Slack, Discord or Telegram — somewhere the notification sound will actually wake you up.

Publish a status page.
Even a personal project benefits from a public status page: it deflects the "is it down for you too?" questions and doubles as evidence when a provider claims the outage was yours.

UpWatch does all four for free on the Starter plan. Add your URL, pick a channel, and you're monitoring in under a minute.`,
  },
  {
    slug: "http-status-codes-monitoring",
    title: "HTTP 200 vs 301 vs 500 — what uptime tools actually check",
    description:
      "A quick primer on HTTP status codes, why '2xx or 3xx' is the right definition of 'up', and how UpWatch decides when to alert.",
    datePublished: "2026-01-20",
    author: "UpWatch Team",
    readingMinutes: 4,
    body: `"Is the site up?" sounds like a yes/no question. Under the hood it's a three-digit number.

2xx — success.
200 is the classic OK. 204 (no content) and 206 (partial) are also fine. If your monitor sees a 2xx and got the response inside its timeout, everything is working.

3xx — redirects.
A 301 or 302 usually means "you asked for the wrong URL, try this one". For uptime purposes that's still up: the server answered, and it answered quickly. UpWatch treats any 2xx or 3xx as healthy.

4xx — you broke it.
404 (not found), 401 (unauthorised), 403 (forbidden). These almost always mean the request was wrong, not that the server is down. But if your homepage suddenly returns 404, something on your side changed — worth an alert.

5xx — the server broke it.
500 (internal error), 502 (bad gateway), 503 (unavailable), 504 (timeout). Any 5xx is a red flag. UpWatch immediately opens an incident and fires alerts.

Timeouts are their own thing.
If the request never completes within the timeout window (default 10s), the monitor treats it as down. Slow-and-eventually-responds is still down for your users.`,
  },
  {
    slug: "slack-downtime-alerts",
    title: "Setting up Slack alerts for downtime in 5 minutes",
    description:
      "Step-by-step: create a Slack incoming webhook, add it to UpWatch, and get instant #alerts channel pings when your site goes down.",
    datePublished: "2026-01-27",
    author: "UpWatch Team",
    readingMinutes: 3,
    body: `Slack downtime alerts land in the same place your team already lives. Setup takes about five minutes.

1. Create an incoming webhook in Slack.
Go to your Slack workspace → Apps → search for "Incoming Webhooks". Add it, pick the channel (a dedicated #alerts channel is ideal), and copy the webhook URL. It looks like https://hooks.slack.com/services/T.../B.../....

2. Add the channel to UpWatch.
In the UpWatch dashboard, open the Alert channels panel. Pick "Slack", paste the webhook URL, click Add. UpWatch validates that it starts with https:// before saving.

3. Test it.
Toggle a monitor off and on, or wait for the next natural check. When a monitor flips to DOWN, UpWatch posts to the channel with the URL, error message and a link back to the dashboard. When it recovers, a green "back UP" message follows.

Discord and Telegram work the same way.
Discord uses incoming webhooks too (Server Settings → Integrations → Webhooks). Telegram uses a bot and a chat_id — UpWatch's built-in bot handles delivery once you paste the chat_id.

That's the whole setup. From here, silencing an alert is one toggle in the Alert channels panel — no code changes, no redeploys.`,
  },
];

export function findPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}
