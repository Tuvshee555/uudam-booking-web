import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/server/prisma";
import { getCategoryWithTrips as getCategoryWithTripsUncached } from "@/server/catalog";
import { tripCountsByCategory as tripCountsByCategoryUncached } from "@/server/categoryCounts";
import { localeAlternates } from "@/lib/hreflang";
import CategoryPageClient from "./CategoryPageClient";

type Props = { params: Promise<{ id: string }> };

/**
 * Pre-render every real category at build time. Without `generateStaticParams`
 * defined at all (even returning []), Next never adds this route to its
 * prerender manifest, and NOTHING caches — not this `revalidate`, not
 * `unstable_cache` below, nothing — every visit renders from scratch.
 * Confirmed directly against `.next/prerender-manifest.json` on the sibling
 * trips/[slug] route, which had the identical symptom (permanent
 * `Cache-Control: no-store`) until this was added there.
 */
export async function generateStaticParams() {
  const categories = await prisma.category.findMany({ select: { slug: true, id: true } });
  return categories.map((category) => ({ id: category.slug ?? category.id }));
}

/**
 * Without this the page is prerendered once at build time and its trip list
 * is frozen until the next deploy.
 *
 * Saving a category or a trip revalidates this path immediately (see
 * revalidateCategoryPages in /api/categories and revalidateTripPages in
 * /api/trips/[id]), so this timer is a safety net, not the only way an
 * edit reaches a visitor.
 */
export const revalidate = 300;

/**
 * `cache` dedupes within one request (generateMetadata + the page share a
 * call); `unstable_cache` is what persists it across requests and visitors
 * — plain Prisma queries are invisible to Next's route cache otherwise.
 */
const findCategory = cache(
  unstable_cache(
    async (idOrSlug: string) => {
      return prisma.category.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
        select: {
          id: true,
          categoryName: true,
          description: true,
          image: true,
        },
      });
    },
    ["category-detail"],
    { revalidate: 300 },
  ),
);

const getCategoryWithTrips = unstable_cache(getCategoryWithTripsUncached, ["category-detail-trips"], {
  revalidate: 300,
});

/**
 * `tripCountsByCategory` returns a `Map`, which doesn't survive
 * `unstable_cache`'s serialization (it comes back a plain object, so `.get`
 * is gone — this broke the build the first time). Cache the serializable
 * entries array instead and rebuild the Map after.
 */
const getTripCountEntries = unstable_cache(
  async () => [...(await tripCountsByCategoryUncached())],
  ["category-detail-counts"],
  { revalidate: 300 },
);
async function tripCountsByCategory() {
  return new Map(await getTripCountEntries());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const category = await findCategory(id);

  if (!category) {
    return { title: "Ангилал олдсонгүй" };
  }

  const description =
    category.description?.trim() ||
    `${category.categoryName} чиглэлийн ${
      (await tripCountsByCategory()).get(category.id) ?? 0
    } аялал.`;

  return {
    title: category.categoryName,
    description,
    openGraph: {
      title: category.categoryName,
      description,
      type: "website",
      images: category.image ? [{ url: category.image, width: 1200, height: 630 }] : undefined,
    },
    alternates: { languages: localeAlternates(`/category/${id}`) },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { id } = await params;
  const category = await findCategory(id);

  // Without this, a bad category link rendered "Энэ ангилалд ... алга
  // байна" — the same copy as a real, empty category — instead of a 404.
  if (!category) notFound();

  // Same lookup the client hook would otherwise make on first paint, seeded
  // here so the trip grid exists in the initial HTML. Previously this page
  // fetched category data only for generateMetadata and handed the client
  // component nothing but the id, so the page shipped zero trip cards.
  const initialData = await getCategoryWithTrips(id);

  return <CategoryPageClient id={id} initialData={initialData ?? undefined} />;
}
