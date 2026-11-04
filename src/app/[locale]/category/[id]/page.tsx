import { cache, Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PageHero from "@/components/site/PageHero";
import CatalogBrowser from "@/components/catalog/CatalogBrowser";
import CatalogSkeleton from "@/components/catalog/CatalogSkeleton";
import { prisma } from "@/server/prisma";
import { getTripSummaries } from "@/server/catalog";
import { getPriceRanges } from "@/server/priceRanges";
import { renderTime } from "@/server/clock";
import { ulaanbaatarDay } from "@/lib/calendar";
import { canonicalPath } from "@/lib/locales";
import { shareMetadata } from "@/lib/seo";
import { formatCategoryName } from "@/lib/tripDisplay";

type Props = { params: Promise<{ id: string }> };

/**
 * Pre-render every real category at build time. Without `generateStaticParams`
 * defined at all (even returning []), Next never adds this route to its
 * prerender manifest, and nothing caches — every visit renders from scratch.
 */
export async function generateStaticParams() {
  const categories = await prisma.category.findMany({ select: { slug: true, id: true } });
  return categories.map((category) => ({ id: category.slug ?? category.id }));
}

/**
 * Saving a trip or a category, or a booking that fills or reopens a date,
 * refreshes this page at once (server/revalidate.ts); the day is a safety net.
 */
export const revalidate = 86400;

/**
 * Read once per render (React's cache shares it between the metadata and the
 * page). The page itself is the cache: a separate data cache under it only
 * added a second write each time the page was rebuilt.
 */
const findCategory = cache(async (idOrSlug: string) =>
  prisma.category.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, categoryName: true, description: true, image: true, slug: true },
  }),
);

function inCategory(id: string) {
  return (trip: { categoryId: string | null; categories: { id: string }[] }) =>
    trip.categoryId === id || trip.categories.some((category) => category.id === id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const category = await findCategory(id);
  if (!category) return { title: "Ангилал олдсонгүй" };

  const name = formatCategoryName(category.categoryName);
  const count = (await getTripSummaries()).filter(inCategory(category.id)).length;
  const description =
    category.description?.trim() || `${name} — ${count} аялал. Хөтөлбөр, огноо бүрийн үнэ, багтсан зүйлсийг харж онлайнаар захиална.`;

  return {
    title: name,
    description,
    // An empty category is a thin page: keep it out of search results.
    ...(count === 0 ? { robots: { index: false, follow: true } } : {}),
    ...shareMetadata(`/category/${category.slug ?? id}`, `${name} · Uudam Travel`, description, category.image ? { url: category.image, width: 1200, height: 630 } : undefined),
  };
}

export default async function CategoryPage({ params }: Props) {
  const { id } = await params;
  const category = await findCategory(id);
  if (!category) notFound();

  const [trips, prices] = await Promise.all([getTripSummaries(), getPriceRanges()]);
  const now = renderTime();
  const name = formatCategoryName(category.categoryName);
  const own = trips.filter(inCategory(category.id));
  const cover = own.find((trip) => trip.image)?.image ?? category.image;

  return (
    <>
      <PageHero
        compact
        crumbs={[
          { label: "Нүүр", href: canonicalPath("") },
          { label: "Аялалууд", href: canonicalPath("/trips") },
          { label: name },
        ]}
        eyebrow="Аяллын төрөл"
        title={name}
        lede={category.description?.trim() || `${own.length} аялал. Чиглэл, хөдлөх сар, үнээр шүүж харьцуулаарай.`}
        image={cover}
      />
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogBrowser
          initialTrips={own}
          prices={prices}
          now={now}
          currentYear={Number(ulaanbaatarDay(now).slice(0, 4))}
          lockedCategory={{ id: category.id, name }}
        />
      </Suspense>
    </>
  );
}
