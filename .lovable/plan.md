## upwatch.online — dark mode landing page

Build the "Precision dark mode" direction as the home page (`/`), matching the prototype's composition, tokens, and copy.

### Sections (in order)
1. **Nav** — pulsing brand dot + "UpWatch" wordmark, links (Product, Status, Pricing), white pill CTA "Start Monitoring"
2. **Hero** — centered, "Sleep better while we watch your pings." + subhead + primary green CTA ($29/mo → Stripe) + secondary "View Live Demo"
3. **Live Demo module** — dark surface card with 2 monitor rows (API Gateway, CDN) showing bar-chart uptime history + uptime %, one bar showing a yellow dip
4. **Pricing** — 3 tiers (Starter $0, Pro $29 highlighted with green border + POPULAR badge, Business $99), Stripe link on Pro
5. **Testimonials** — 2-card grid
6. **FAQ** — accordion (5 Qs incl. "What happens if my site goes down?")
7. **Email capture** — bright green rounded block with email form
8. **Footer** — brand + links + mono status line

### Design tokens (add to `src/styles.css`)
- `--brand: #10b981`, `--brand-dark: #059669`
- `--bg: #0a0a0a`, `--surface: #171717`, `--border: #262626`
- Fonts: Inter (sans) + JetBrains Mono (mono) via `<link>` in `__root.tsx`
- Keep existing shadcn tokens; add new brand tokens alongside

### Files to change
- `src/routes/index.tsx` — replace placeholder with the full landing page (single file; sections as local components)
- `src/routes/__root.tsx` — add Google Fonts `<link>` tags; update head metadata (title "UpWatch — Website Uptime Monitoring", description, og tags)
- `src/styles.css` — add brand/bg/surface/border tokens + Inter/JetBrainsMono font families in `@theme`

### Out of scope for this pass
- No Stripe integration (buttons link to `https://buy.stripe.com/...` placeholder as in prototype)
- No email form backend (form is visual; submit no-ops)
- No Uptime Kuma live API wiring — status module uses static demo data matching the prototype
- No FAQ interactivity beyond simple details/summary (or shadcn Accordion)

Ping me after approval and I'll build it.