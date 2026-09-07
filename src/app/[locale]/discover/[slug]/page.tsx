import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";

import { prisma } from "@/server/prisma";
import { formatFullDate } from "@/lib/departures";

type Props = { params: Promise<{ locale: string; slug: string }> };

const findArticle = cache(async (slug: string) =>
  prisma.knowledgeArticle.findFirst({ where: { slug, isPublished: true } }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await findArticle(slug);

  if (!article) return { title: "Мэдээлэл олдсонгүй" };

  const description = article.excerpt?.trim() || article.facts[0] || article.body?.slice(0, 160).trim();

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      type: "article",
      images: article.coverImage ? [{ url: article.coverImage, width: 1200, height: 630 }] : undefined,
    },
  };
}

export default async function DiscoverArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  const article = await findArticle(slug);

  if (!article) notFound();

  return (
    <article className="uudam-container max-w-3xl py-10">
      <nav className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href={`/${locale}`} className="hover:text-primary">
          Нүүр
        </Link>
        <span>/</span>
        <Link href={`/${locale}/discover`} className="hover:text-primary">
          Танин мэдэхүй
        </Link>
      </nav>

      <h1 className="text-2xl font-bold leading-tight md:text-3xl">{article.title}</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {formatFullDate(article.publishedAt ?? article.createdAt)}
      </p>

      {article.coverImage && (
        <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl bg-secondary">
          <Image
            src={article.coverImage}
            alt={article.title}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            priority
          />
        </div>
      )}

      {article.excerpt && (
        <p className="mt-6 text-[16px] font-medium leading-relaxed text-muted-foreground">
          {article.excerpt}
        </p>
      )}

      {article.video && (
        <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl bg-black">
          <video src={article.video} controls playsInline className="h-full w-full" />
        </div>
      )}

      {article.facts.length > 0 && (
        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-primary">
            <Sparkles className="h-4 w-4" />
            Сонирхолтой баримтууд
          </div>
          <ul className="mt-3 space-y-2.5">
            {article.facts.map((fact, index) => (
              <li key={index} className="flex gap-2.5 text-[15px] leading-relaxed">
                <span className="mt-0.5 text-primary">•</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {article.body && (
        <div className="mt-6 whitespace-pre-line text-[15px] leading-relaxed">{article.body}</div>
      )}
    </article>
  );
}
