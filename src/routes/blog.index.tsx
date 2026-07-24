import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL, OG_IMAGE } from "@/lib/site";
import { MarketingLayout } from "@/components/MarketingLayout";
import { POSTS } from "@/lib/blog-posts";

const TITLE = "UpWatch Blog — uptime monitoring guides";
const DESC =
  "Practical guides on uptime monitoring, HTTP status codes, alerting and status pages from the UpWatch team.";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/blog` },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/blog` }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  return (
    <MarketingLayout>
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-8">
        <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
        <p className="mt-4 text-white/70">Short, useful pieces on uptime monitoring.</p>
      </section>
      <section className="max-w-3xl mx-auto px-6 pb-24 grid gap-6">
        {POSTS.map((p) => (
          <Link
            key={p.slug}
            to="/blog/$slug"
            params={{ slug: p.slug }}
            className="block rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:border-[#10b981]/50 transition-colors"
          >
            <div className="text-xs text-white/50">
              {new Date(p.datePublished).toLocaleDateString("en-GB", { dateStyle: "medium" })} · {p.readingMinutes} min read
            </div>
            <h2 className="mt-1 text-xl font-semibold">{p.title}</h2>
            <p className="mt-2 text-sm text-white/70">{p.description}</p>
          </Link>
        ))}
      </section>
    </MarketingLayout>
  );
}
