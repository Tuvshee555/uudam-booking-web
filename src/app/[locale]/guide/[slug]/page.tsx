import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { prisma } from "@/server/prisma";

type Props = { params: Promise<{ locale: string; slug: string }> };

/**
 * Pre-render every published guide at build time. Without
 * `generateStaticParams` defined at all (even returning []), Next never adds
 * this route to its prerender manifest and nothing caches — not `revalidate`,
 * not `unstable_cache`, nothing. See the identical fix (and the full story)
 * on trips/[slug]/page.tsx.
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
    openGraph: {
      title: post.title,
      description,
      type: "article",
      images: post.coverImage ? [{ url: post.coverImage, width: 1200, height: 630 }] : undefined,
    },
  };
}

export default async function GuidePostPage({ params }: Props) {
  const { locale, slug } = await params;
  const post = await findPost(slug);

  // A draft or deleted article must 404 for real, not render an empty page.
  if (!post) notFound();

  return (
    <article className="uudam-container max-w-3xl py-10">
      <nav className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href={`/${locale}`} className="hover:text-primary">
          Нүүр
        </Link>
        <span>/</span>
        <Link href={`/${locale}/guide`} className="hover:text-primary">
          Зөвлөгөө
        </Link>
      </nav>

      <h1 className="text-2xl font-bold leading-tight md:text-3xl">{post.title}</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {(post.publishedAt ?? post.createdAt).toLocaleDateString("mn-MN", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      {post.coverImage && (
        <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl bg-secondary">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            priority
          />
        </div>
      )}

      {post.excerpt && (
        <p className="mt-6 text-[16px] font-medium leading-relaxed text-muted-foreground">
          {post.excerpt}
        </p>
      )}

      <div className="mt-6 whitespace-pre-line text-[15px] leading-relaxed">{post.body}</div>
    </article>
  );
}
