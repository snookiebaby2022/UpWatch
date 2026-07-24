## SEO Plan — UpTime Buddy

Foundations (favicon, og-image, robots.txt, sitemap.xml, per-route metadata, JSON-LD) are already live from an earlier phase. This plan extends beyond the basics: content, structured data depth, performance signals, and off-page.

---

### Phase 1 — Audit & fix (baseline)

- Run a fresh scan (SEO tab) to catch regressions.
- Verify each public route (`/`, `/status`, `/auth`, `/privacy`, `/terms`, `/welcome`) has unique title, description, `og:title`, `og:description`, self-referencing canonical + `og:url`.
- Confirm no `noindex` leaks on the public routes and that `_authenticated/*`, `/reset-password`, `/welcome`, `/auth` carry `noindex, nofollow` (they aren't shareable content).
- Sitemap: keep only indexable pages (`/`, `/status`). Drop auth/legal from priority weighting; keep legal at low priority.

### Phase 2 — Content pages (biggest lever)

New route files, each with dedicated head() + JSON-LD:

- `/features` — Monitors, multi-region checks, alerts, status pages.
- `/pricing` — Extracted from the homepage anchor; own page enables ranking for "uptime monitoring pricing".
- `/integrations/slack`, `/integrations/discord`, `/integrations/telegram`, `/integrations/email` — one page per channel; each targets `[tool] uptime alerts`.
- `/compare/uptime-kuma`, `/compare/uptimerobot`, `/compare/betterstack` — comparison pages; long-tail intent, low competition.
- `/blog` index + first 3 posts:
  - "How to monitor a website for free"
  - "HTTP 200 vs 301 vs 500 — what uptime tools actually check"
  - "Setting up Slack alerts for downtime in 5 minutes"
  Each post: `Article` JSON-LD, cover image wired to `og:image` + `twitter:image`, author, datePublished.
- `/docs` (light): `Getting started`, `API`, `Cron & multi-region`.

### Phase 3 — Structured data depth

- `__root.tsx`: keep `Organization` + `WebSite` JSON-LD; add `SearchAction` when a search route exists.
- `/` : `SoftwareApplication` with `offers` (£0, £10, £30) + `AggregateRating` only when real reviews exist.
- `/pricing`: `Product` + `Offer` per plan.
- `/status`: `WebPage` + a lightweight status summary (avoid fake uptime numbers).
- FAQ block on `/` and `/pricing`: `FAQPage` JSON-LD mirroring visible Q&A only.
- Blog posts: `Article` + `BreadcrumbList`.
- Compare pages: `BreadcrumbList`.

### Phase 4 — Technical & performance

- Preload the hero font subset; `font-display: swap` (already true via Google Fonts link).
- Image discipline: `loading="lazy"` on below-fold; explicit `width`/`height` to lock CLS; convert `og-image.jpg` variants for Twitter (1200x630) — done, verify.
- HTTP caching headers on `sitemap.xml` (already 1h) and static `public/*`.
- Ensure a single H1 per route and semantic sectioning (`<header>`, `<main>`, `<section>`, `<footer>`).
- Add `<link rel="alternate" hreflang="en" href="https://uptime-buddy-hq.lovable.app/">` on `/` (EN-only for now; expand later).
- Core Web Vitals: run Lighthouse on `/` and `/status`; target LCP < 2.5s, CLS < 0.1, INP < 200ms.
- Add `theme-color` meta for mobile browser chrome (matches brand `#10b981`).

### Phase 5 — Keyword targeting (Semrush-backed)

Primary cluster: `uptime monitoring`, `website uptime monitor`, `free uptime monitor`, `status page`, `http monitoring`.
Long-tail: `uptime monitor with telegram alerts`, `self hosted uptime monitor alternative`, `uptime monitor with multi region checks`.
Comparison intent: `uptimerobot alternative`, `better stack alternative`.

I'll run `semrush--keyword_research` on the top 5, `serp_analysis` on the ones with KDI ≤ 40, and map each to a specific route in Phase 2.

### Phase 6 — Off-page & discovery

- Submit `sitemap.xml` in Google Search Console and Bing Webmaster Tools (user action).
- Publish on:
  - Product Hunt (launch page)
  - AlternativeTo (listing under UptimeRobot alternatives)
  - GitHub Awesome-Selfhosted / awesome-monitoring PRs
  - Reddit r/selfhosted, r/webdev show-off threads
  - Indie Hackers post
- Backlinks from: 2–3 dev-blog guest posts, monitoring-comparison roundups.
- Social: attach `og:image` per content page; verify link previews with the Twitter Card and Facebook Sharing Debuggers after publish.

### Phase 7 — Ongoing

- Weekly: check Search Console for crawl errors and impressions per page.
- Monthly: `semrush--seo_trend` for `uptime-buddy-hq.lovable.app`; add 1 blog post + 1 comparison page.
- After brand traction: buy `upwatch.online` (already reserved) and 301 the Lovable domain to it; update canonical + `og:url` + sitemap `BASE_URL` in one pass.

---

### What I'll build in code when you approve

1. New route files: `/features`, `/pricing`, `/integrations/[slack|discord|telegram|email]`, `/compare/[uptime-kuma|uptimerobot|betterstack]`, `/blog`, `/blog/$slug` + 3 seed posts, `/docs` shell.
2. Structured-data additions to `__root.tsx`, `/`, `/pricing`, `/status`, blog posts.
3. `noindex` guards on non-shareable routes; sitemap trimmed to indexable set.
4. Lighthouse pass and image/CLS fixes.
5. Semrush keyword mapping doc committed at `docs/seo-keywords.md`.

Approve and I'll execute Phase 1–4 in one batch, then run Semrush for Phase 5.
