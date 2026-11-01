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
 * Pre-render every published guide at build time. Without
 * `generateStaticParams` defined at all (even returning []), Next never adds
 * this route to its prerender manifest and nothing caches.
 */
export async function generateStaticParams() {
  const posts = await prisma.post.findMany({ where: { isPublished: true }, select: { slug: true } });
  return posts.map((post) => ({ slug: post.slug }));
}

export const revalidate = 300;

const findPost = cache(
  unstable_cache(
    async (slug: string) => prisma.post.findFirst({ where: { slug, isPublished: true } }),
    ["guide-post"],
    { revalidate: 300 },
  ),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await findPost(slug);

  if (!post) return { title: "Нийтлэл олдсонгүй" };

  const description = post.excerpt?.trim() || post.body.slice(0, 160).trim();

  return {
    title: post.title,
    description,
    ...shareMetadata(
      `/guide/${slug}`,
      post.title,
      description,
      post.coverImage ? { url: post.coverImage, width: 1200, height: 630 } : undefined,
      "article",
    ),
  };
}

export default async function GuidePostPage({ params }: Props) {
  const { slug } = await params;
  const post = await findPost(slug);

  // A draft or deleted article must 404 for real, not render an empty page.
  if (!post) notFound();

  return (
    <ArticleLayout
      article={post}
      path={`/guide/${slug}`}
      eyebrow="Аялалд бэлтгэх"
      crumbs={[
        { label: "Нүүр", href: canonicalPath("") },
        { label: "Аялалд бэлтгэх", href: canonicalPath("/guide") },
        { label: post.title },
      ]}
      related={relatedTripsFor(post, await getTripSummaries())}
    />
  );
}
