import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/server/prisma";
import { getTripSummaries } from "@/server/catalog";
import { canonicalPath } from "@/lib/locales";
import { shareMetadata } from "@/lib/seo";
import ArticleLayout, { relatedTripsFor } from "@/components/content/ArticleLayout";

type Props = { params: Promise<{ locale: string; slug: string }> };

/**
 * Pre-render every published article at build time. Without
 * `generateStaticParams` defined at all (even returning []), Next never adds
 * this route to its prerender manifest and nothing caches.
 */
export async function generateStaticParams() {
  const articles = await prisma.knowledgeArticle.findMany({
    where: { isPublished: true },
    select: { slug: true },
  });
  return articles.map((article) => ({ slug: article.slug }));
}

export const revalidate = 86400;

const findArticle = cache(
  unstable_cache(
    async (slug: string) => prisma.knowledgeArticle.findFirst({ where: { slug, isPublished: true } }),
    ["discover-article"],
    { revalidate: 300 },
  ),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await findArticle(slug);

  if (!article) return { title: "Мэдээлэл олдсонгүй" };

  const description = article.excerpt?.trim() || article.facts[0] || article.body?.slice(0, 160).trim();

  return {
    title: article.title,
    description,
    ...shareMetadata(
      `/discover/${slug}`,
      article.title,
      description ?? article.title,
      article.coverImage ? { url: article.coverImage, width: 1200, height: 630 } : undefined,
      "article",
    ),
  };
}

export default async function DiscoverArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await findArticle(slug);

  if (!article) notFound();

  return (
    <ArticleLayout
      article={article}
      path={`/discover/${slug}`}
      eyebrow="Танин мэдэхүй"
      crumbs={[
        { label: "Нүүр", href: canonicalPath("") },
        { label: "Танин мэдэхүй", href: canonicalPath("/discover") },
        { label: article.title },
      ]}
      related={relatedTripsFor(article, await getTripSummaries())}
    />
  );
}
