import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import PageHero from "@/components/site/PageHero";
import { prisma, withPrismaRetry } from "@/server/prisma";
import { getTripSummaries } from "@/server/catalog";
import { destinationCounts } from "@/lib/destinations";
import { fullDateTitle } from "@/lib/calendar";
import { canonicalPath } from "@/lib/locales";
import { destinationHref } from "@/lib/siteNav";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Танин мэдэхүй",
  description: "Аяллын чиглэлүүдийн түүх, сонирхолтой баримт, очих газрын тухай нийтлэл — Uudam Travel.",
  ...shareMetadata("/discover", "Танин мэдэхүй · Uudam Travel", "Аяллын чиглэлүүдийн түүх, сонирхолтой баримт."),
};

/** Saving an article refreshes this page at once (revalidateDiscoverPages in /api/knowledge). */
export const revalidate = 300;

export default async function DiscoverIndexPage() {
  const [articles, trips] = await Promise.all([
    withPrismaRetry(() =>
      prisma.knowledgeArticle.findMany({
        where: { isPublished: true },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        select: { id: true, slug: true, title: true, excerpt: true, coverImage: true, facts: true, publishedAt: true, createdAt: true },
      }),
    ),
    getTripSummaries(),
  ]);
  const [lead, ...rest] = articles;
  const places = destinationCounts(trips).slice(0, 10);

  return (
    <>
      <PageHero
        crumbs={[{ label: "Нүүр", href: canonicalPath("") }, { label: "Танин мэдэхүй" }]}
        eyebrow="Танин мэдэхүй"
        title="Очих газраа танихаас эхэл"
        lede="Аяллын чиглэлүүдийн түүх, сонирхолтой баримт — явахаасаа өмнө уншаад очихоор илүү сонирхолтой."
        image={lead?.coverImage}
      />

      <div className="site-container pb-20 pt-14">
        {!lead ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-gold-text" aria-hidden="true" />
            <p className="display-3 mt-4 text-foreground">Нийтлэл удахгүй нэмэгдэнэ</p>
            <Link href={canonicalPath("/trips")} className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground focus-ring">Аялал үзэх</Link>
          </div>
        ) : (
          <>
            <Link href={canonicalPath(`/discover/${lead.slug}`)} className="group grid overflow-hidden rounded-xl border border-border bg-card focus-ring lg:grid-cols-[1.3fr_1fr]">
              <div className="relative min-h-[260px] bg-sand lg:min-h-[420px]">
                {lead.coverImage && <Image src={lead.coverImage} alt="" fill sizes="(max-width: 1024px) 100vw, 60vw" quality={75} className="photo-zoom object-cover" />}
              </div>
              <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-12">
                <p className="text-[12.5px] text-muted-foreground">{fullDateTitle(lead.publishedAt ?? lead.createdAt)}</p>
                <h2 className="display-2 mt-3 text-foreground">{lead.title}</h2>
                {(lead.excerpt || lead.facts[0]) && <p className="lede mt-4 line-clamp-4">{lead.excerpt || lead.facts[0]}</p>}
                <span className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold text-foreground">
                  <span className="link-draw">Унших</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </div>
            </Link>

            {rest.length > 0 && (
              <ul className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((article) => (
                  <li key={article.id}>
                    <Link href={canonicalPath(`/discover/${article.slug}`)} className="group block focus-ring">
                      <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-sand">
                        {article.coverImage && <Image src={article.coverImage} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="photo-zoom object-cover" />}
                      </div>
                      <p className="mt-4 text-[12px] text-muted-foreground">{fullDateTitle(article.publishedAt ?? article.createdAt)}</p>
                      <h2 className="mt-1.5 text-[17px] font-semibold leading-snug text-foreground group-hover:underline group-hover:decoration-gold group-hover:underline-offset-4">{article.title}</h2>
                      {article.excerpt && <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-muted-foreground">{article.excerpt}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {places.length > 0 && (
          <section aria-labelledby="discover-places" className="mt-20 border-t border-border pt-14">
            <p className="eyebrow">Чиглэл</p>
            <h2 id="discover-places" className="display-2 mt-3 text-foreground">Эдгээр газар руу аялал бий</h2>
            <ul className="mt-8 flex flex-wrap gap-2.5">
              {places.map((place) => (
                <li key={place.key}>
                  <Link href={destinationHref(place.key)} className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-[14px] font-semibold text-foreground focus-ring hover:border-foreground/35">
                    {place.label}
                    <span className="text-[12px] font-normal tabular-nums text-muted-foreground">{place.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
