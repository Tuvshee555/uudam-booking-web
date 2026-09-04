import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { prisma } from "@/server/prisma";

export const metadata: Metadata = {
  title: "Аяллын зөвлөгөө",
  description:
    "Виз, ачаа тээш, төлбөр, бэлтгэл — аялахаас өмнө мэдэх ёстой бүхнийг Uudam Travel-ийн зөвлөгөөнөөс.",
  openGraph: {
    title: "Аяллын зөвлөгөө · Uudam Travel",
    description: "Аялахаас өмнө мэдэх ёстой зөвлөгөө, мэдээлэл.",
    type: "website",
  },
};

/**
 * Without this the page is prerendered once at build time and its data is
 * frozen until the next deploy — staff edit trips daily, and the departures
 * cutoff is a `new Date()` that would freeze with it.
 */
export const revalidate = 60;

function formatDate(value: Date) {
  return value.toLocaleDateString("mn-MN", { year: "numeric", month: "long", day: "numeric" });
}

export default async function GuideIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const posts = await prisma.post.findMany({
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
        <h1 className="text-2xl font-bold md:text-3xl">Аяллын зөвлөгөө</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Виз, ачаа тээш, төлбөр, бэлтгэл — аялахаас өмнө мэдэх зүйлс.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium">Одоогоор нийтлэл алга</p>
          <p className="mt-1 text-sm text-muted-foreground">Удахгүй нэмэгдэнэ.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/${locale}/guide/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
            >
              {post.coverImage && (
                <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
                  <Image
                    src={post.coverImage}
                    alt={post.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <h2 className="text-[15px] font-semibold leading-snug">{post.title}</h2>
                {post.excerpt && (
                  <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                )}
                <p className="mt-auto pt-3 text-[11px] text-muted-foreground">
                  {formatDate(post.publishedAt ?? post.createdAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
