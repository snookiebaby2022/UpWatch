import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SITE_URL, OG_IMAGE } from "@/lib/site";
import { MarketingLayout } from "@/components/MarketingLayout";
import { findPost } from "@/lib/blog-posts";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = findPost(params.slug);
    if (!post) throw notFound();
    return { slug: post.slug };
  },
  head: ({ params, loaderData }) => {
    const post = loaderData ? findPost(loaderData.slug) : undefined;
    if (!post) {
      return {
        meta: [
          { title: "Article not found — UpWatch" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const url = `${SITE_URL}/blog/${params.slug}`;
    return {
      meta: [
        { title: `${post.title} — UpWatch` },
        { name: "description", content: post.description },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: OG_IMAGE },
        { property: "article:published_time", content: post.datePublished },
        { property: "article:author", content: post.author },
        { name: "twitter:title", content: post.title },
        { name: "twitter:description", content: post.description },
        { name: "twitter:image", content: OG_IMAGE },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.description,
            author: { "@type": "Organization", name: post.author },
            publisher: { "@type": "Organization", name: "UpWatch", logo: { "@type": "ImageObject", url: `${SITE_URL}/favicon.png` } },
            datePublished: post.datePublished,
            image: OG_IMAGE,
            mainEntityOfPage: url,
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Blog", item: `${SITE_URL}/blog` },
              { "@type": "ListItem", position: 2, name: post.title, item: url },
            ],
          }),
        },
      ],
    };
  },
  component: BlogPostPage,
  notFoundComponent: () => (
    <MarketingLayout>
      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-bold">Article not found</h1>
        <p className="mt-2 text-white/70">This post doesn't exist or has been moved.</p>
        <Link to="/blog" className="mt-6 inline-flex text-[#10b981] hover:underline">← Back to the blog</Link>
      </section>
    </MarketingLayout>
  ),
});

function BlogPostPage() {
  const { slug } = Route.useLoaderData();
  const post = findPost(slug);
  if (!post) return null;
  const paragraphs = post.body.split(/\n\n+/);
  return (
    <MarketingLayout>
      <article className="max-w-3xl mx-auto px-6 pt-20 pb-24">
        <div className="text-xs text-white/50">
          {new Date(post.datePublished).toLocaleDateString("en-GB", { dateStyle: "medium" })} · {post.readingMinutes} min read
        </div>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">{post.title}</h1>
        <div className="mt-8 space-y-5 text-white/80 leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-12">
          <Link to="/blog" className="text-[#10b981] hover:underline">← Back to the blog</Link>
        </div>
      </article>
    </MarketingLayout>
  );
}
