import Image from "next/image";
import { Sparkles } from "lucide-react";

import Breadcrumbs, { type Crumb } from "@/components/site/Breadcrumbs";
import JsonLd from "@/components/content/JsonLd";
import ArticleVideo from "@/components/content/ArticleVideo";
import TripCard from "@/components/trip/TripCard";
import { ArrowLink } from "@/components/site/SectionHeading";
import { fullDateTitle } from "@/lib/calendar";
import { tripDestinations } from "@/lib/destinations";
import { canonicalPath } from "@/lib/locales";
import { SITE_URL } from "@/lib/siteUrl";
import type { Trip } from "@/types/trip";

export type ArticleContent = {
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  body: string | null;
  facts?: string[];
  video?: string | null;
  // unstable_cache hands these back as ISO strings.
  publishedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

/** Trips that go where the article is about, read from its title, summary and facts (the body only as a fallback). */
export function relatedTripsFor(article: ArticleContent, trips: Trip[], limit = 4): Trip[] {
  const lead = [article.title, article.excerpt, ...(article.facts ?? [])].filter(Boolean).join(" ");
  let keys = tripDestinations({ title: lead }).map((destination) => destination.key);
  if (!keys.length && article.body) keys = tripDestinations({ title: article.body }).map((destination) => destination.key).slice(0, 2);
  if (!keys.length) return [];
  return trips.filter((trip) => tripDestinations(trip).some((destination) => keys.includes(destination.key))).slice(0, limit);
}

/**
 * A travel guide or a destination article: dated, readable, with the trips
 * that go where it is about. Shared by /guide/[slug] and /discover/[slug].
 */
export default function ArticleLayout({
  article,
  path,
  crumbs,
  eyebrow,
  related,
}: {
  article: ArticleContent;
  path: string;
  crumbs: Crumb[];
  eyebrow: string;
  related: Trip[];
}) {
  const published = new Date(article.publishedAt ?? article.createdAt);
  const updated = new Date(article.updatedAt);
  const updatedLater = updated.getTime() - published.getTime() > 24 * 60 * 60 * 1000;
  const url = `${SITE_URL}${canonicalPath(path)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    ...(article.excerpt ? { description: article.excerpt } : {}),
    ...(article.coverImage ? { image: [article.coverImage] } : {}),
    datePublished: published.toISOString(),
    dateModified: updated.toISOString(),
    inLanguage: "mn",
    mainEntityOfPage: url,
    url,
    author: { "@type": "Organization", name: "Uudam Travel Agency", url: SITE_URL },
    publisher: { "@type": "Organization", "@id": `${SITE_URL}/#agency`, name: "Uudam Travel Agency", logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` } },
  };

  return (
    <article className="pb-20">
      <JsonLd id="article-json-ld" data={jsonLd} />
      <div className="site-container max-w-4xl pt-8 lg:pt-12">
        <Breadcrumbs items={crumbs} />
        <p className="eyebrow mt-10">{eyebrow}</p>
        <h1 className="display-1 mt-4 text-balance text-foreground">{article.title}</h1>
        <p className="mt-5 text-[13px] text-muted-foreground">
          <time dateTime={published.toISOString()}>{fullDateTitle(published)}</time>
          {updatedLater && (
            <>
              {" · Шинэчилсэн "}
              <time dateTime={updated.toISOString()}>{fullDateTitle(updated)}</time>
            </>
          )}
        </p>
      </div>

      {article.coverImage && (
        <div className="site-container mt-10 max-w-5xl">
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-sand">
            <Image src={article.coverImage} alt={article.title} fill priority fetchPriority="high" sizes="(max-width: 1024px) 100vw, 1024px" quality={75} className="object-cover" />
          </div>
        </div>
      )}

      <div className="site-container mt-10 max-w-3xl">
        {article.excerpt && <p className="font-display text-[1.4rem] leading-relaxed text-foreground sm:text-[1.55rem]">{article.excerpt}</p>}

        {article.video && <ArticleVideo url={article.video} title={article.title} />}

        {article.facts && article.facts.length > 0 && (
          <aside className="mt-10 rounded-xl border border-border bg-card p-6 sm:p-7">
            <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-foreground">
              <Sparkles className="h-4 w-4 text-gold-text" aria-hidden="true" />
              Сонирхолтой баримт
            </p>
            <ul className="mt-4 space-y-3">
              {article.facts.map((fact, index) => (
                <li key={index} className="flex gap-3 text-[15px] leading-relaxed text-foreground">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {article.body && <div className="prose-site mt-10 whitespace-pre-line">{article.body}</div>}
      </div>

      {related.length > 0 && (
        <section aria-labelledby="article-related" className="site-container mt-20 border-t border-border pt-14">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Энэ газар руу</p>
              <h2 id="article-related" className="display-2 mt-3 text-foreground">Холбогдох аялал</h2>
            </div>
            <ArrowLink href={canonicalPath("/trips")}>Бүх аялал</ArrowLink>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6">
            {related.map((trip) => (
              <li key={trip.id}>
                <TripCard trip={trip} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
