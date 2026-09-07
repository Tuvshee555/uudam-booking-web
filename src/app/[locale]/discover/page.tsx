import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Sparkles } from "lucide-react";

import { prisma } from "@/server/prisma";
import { formatFullDate } from "@/lib/departures";

export const metadata: Metadata = {
  title: "Танин мэдэхүй",
  description:
    "Дэлхийн сонирхолтой газрууд, тэдгээрийн тухай баримтууд — Хятадын Их хэрэм хэр урт вэ, гэх мэт.",
  openGraph: {
    title: "Танин мэдэхүй · Uudam Travel",
    description: "Дэлхийн сонирхолтой газрууд, тэдгээрийн тухай баримтууд.",
    type: "website",
  },
};

/**
 * Without this the page is prerendered once at build time and its list is
 * frozen until the next deploy.
 */
export const revalidate = 60;

export default async function DiscoverIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const articles = await prisma.knowledgeArticle.findMany({
    where: { isPublished: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      coverImage: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="uudam-container py-10">
      <header>
        <span className="uudam-eyebrow text-primary">Танин мэдэхүй</span>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Сонирхолтой мэдээлэл</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Дэлхийн газрууд, тэдгээрийн тухай сонин баримтууд.
        </p>
      </header>

      {articles.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border py-16 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Одоогоор мэдээлэл алга</p>
          <p className="mt-1 text-sm text-muted-foreground">Удахгүй нэмэгдэнэ.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/${locale}/discover/${article.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
            >
              {article.coverImage && (
                <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
                  <Image
                    src={article.coverImage}
                    alt={article.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <h2 className="text-[15px] font-semibold leading-snug">{article.title}</h2>
                {article.excerpt && (
                  <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">
                    {article.excerpt}
                  </p>
                )}
                <p className="mt-auto pt-3 text-[11px] text-muted-foreground">
                  {formatFullDate(article.publishedAt ?? article.createdAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
