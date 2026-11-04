import { cache } from "react";
import type { Prisma } from "@prisma/client";

import { prisma, withPrismaRetry } from "@/server/prisma";
import { TRIP_INCLUDE } from "@/server/tripInput";
import { tripCountsByCategory } from "@/server/categoryCounts";
import { cached } from "@/server/cache";
import type { CategoryNode, Trip } from "@/types/trip";
import { summaryFields } from "@/lib/publicTrip";
import { destinationCounts } from "@/lib/destinations";
import { formatCategoryName } from "@/lib/tripDisplay";
import { EMPTY_NAV, type SiteNav } from "@/lib/siteNav";

/**
 * Server-side reads of the public catalogue, shaped exactly like the API
 * responses so pages can seed their client queries with them.
 *
 * `NextResponse.json` turns Dates into ISO strings and the client `Trip` type
 * expects strings, so every result goes through the same JSON round-trip the
 * wire would have applied. Without that the hydrated value and a later refetch
 * would disagree.
 */

/** Departures that ended more than two days ago never reach a card. */
const PAST_GRACE_MS = 2 * 24 * 60 * 60 * 1000;

const SUMMARY_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  country: true,
  city: true,
  region: true,
  destinations: true,
  durationDays: true,
  durationNights: true,
  minTravelers: true,
  maxTravelers: true,
  difficulty: true,
  transport: true,
  languages: true,
  season: true,
  image: true,
  video: true,
  videos: true,
  price: true,
  oldPrice: true,
  discount: true,
  childPrice: true,
  infantPrice: true,
  singleSupplement: true,
  currency: true,
  sourceTripId: true,
  foodIncluded: true,
  brochurePdfUrl: true,
  categoryId: true,
  isFeatured: true,
  isPublished: true,
  salesCount: true,
  avgRating: true,
  reviewCount: true,
  createdAt: true,
  updatedAt: true,
  // Cards, filters and search read a category's id and name and a tag's
  // name, never a category's description, image or place in the tree.
  category: { select: { id: true, categoryName: true, slug: true } },
  categories: { select: { id: true, categoryName: true, slug: true }, orderBy: { categoryName: "asc" } },
  tags: { select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } },
} satisfies Prisma.TripSelect;

async function loadSummaries(where: Prisma.TripWhereInput): Promise<Trip[]> {
  const cutoff = new Date(Date.now() - PAST_GRACE_MS);
  const rows = await withPrismaRetry(() =>
    prisma.trip.findMany({
      where,
      select: {
        ...SUMMARY_SELECT,
        // What a card, the filters and the calendar read off a date: when,
        // the fare, and whether it is still bookable (availability() in
        // lib/departures). End dates, child and infant fares and seat totals
        // belong to the trip page, which loads the full trip; carrying them
        // here sent every list page all 239 dates in full.
        departures: {
          where: { startDate: { gte: cutoff }, status: { notIn: ["CANCELLED", "DEPARTED"] } },
          orderBy: { startDate: "asc" },
          select: { id: true, startDate: true, price: true, status: true, seatsLeft: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
  if (!rows.length) return [];

  // The card reads four small keys of sourceMetadata, which for some trips is
  // hundreds of kilobytes; pull just those keys instead of the whole column.
  const ids = rows.map((row) => row.id);
  // Keep this key list in step with SUMMARY_METADATA_KEYS.
  const metadataRows = await withPrismaRetry(() =>
    prisma.$queryRaw<{ id: string; metadata: Record<string, unknown> | null }[]>`
      SELECT id, jsonb_strip_nulls(jsonb_build_object(
        'marketingBadge', "sourceMetadata"->'marketingBadge',
        'marketing_badge', "sourceMetadata"->'marketing_badge',
        'seats_left', "sourceMetadata"->'seats_left',
        'seats_total', "sourceMetadata"->'seats_total'
      )) AS metadata
      FROM "Trip" WHERE id = ANY(${ids})`,
  );
  const metadata = new Map(metadataRows.map((row) => [row.id, row.metadata]));

  return JSON.parse(JSON.stringify(rows.map((row) => summaryFields(row, metadata.get(row.id) ?? null)))) as Trip[];
}

/**
 * Every published trip as a card-sized record — the catalogue, the home page,
 * the calendar and saved trips render from this. Read fresh for each render
 * (once per request): the page itself is what is cached, and a save
 * regenerates it. An in-memory copy here would outlive the save — the save
 * runs in another route's module instance (or another server) and can't
 * clear it — and the stale list would then be baked into the page for its
 * whole cache life.
 */
export const getTripSummaries = cache((): Promise<Trip[]> => loadSummaries({ isPublished: true }));

/**
 * The same list for the public JSON API, which answers far more requests than
 * pages render: kept 20 s per instance (a save on this instance clears it at
 * once), behind the CDN cache that route sets anyway.
 */
export function getCachedTripSummaries(): Promise<Trip[]> {
  return cached("trips:summaries", 20_000, () => loadSummaries({ isPublished: true }));
}

/**
 * A category plus every trip filed under it *or any descendant category* —
 * browsing "Ази" also shows trips filed under "Ази > Япон". Shared by
 * GET /api/categories/:id/trips and the category page's server fetch, so the
 * descendant walk exists in exactly one place rather than two copies that can
 * silently drift.
 */
export async function getCategoryWithTrips(
  idOrSlug: string,
  { includeDrafts = false }: { includeDrafts?: boolean } = {},
) {
  const categories = await prisma.category.findMany({
    select: { id: true, parentId: true, categoryName: true, slug: true, description: true, image: true },
  });

  const target = categories.find((c) => c.id === idOrSlug || c.slug === idOrSlug);
  if (!target) return null;

  // Breadth-first walk down the tree collecting every descendant id.
  const ids = new Set([target.id]);
  const queue = [target.id];

  while (queue.length) {
    const current = queue.shift();
    for (const category of categories) {
      if (category.parentId === current && !ids.has(category.id)) {
        ids.add(category.id);
        queue.push(category.id);
      }
    }
  }

  const inCategory: Prisma.TripWhereInput = {
    OR: [
      { categoryId: { in: Array.from(ids) } },
      { categories: { some: { id: { in: Array.from(ids) } } } },
    ],
  };

  const category = {
    id: target.id,
    categoryName: target.categoryName,
    slug: target.slug,
    description: target.description,
    image: target.image,
  };

  if (includeDrafts) {
    // Drafts are an admin view and keep staff-only fields.
    const trips = await prisma.trip.findMany({ where: inCategory, include: TRIP_INCLUDE, orderBy: { createdAt: "desc" } });
    return { category, trips: JSON.parse(JSON.stringify(trips)) as Trip[] };
  }

  return { category, trips: await loadSummaries({ ...inCategory, isPublished: true }) };
}

/**
 * Recent published testimonials for the homepage's reviews section — mixed
 * across trips rather than scoped to one, unlike the per-trip list a trip
 * page already renders from `trip.testimonials`. Capped at 9: this is a
 * trust signal, not an archive.
 */
export async function getPublishedTestimonials(limit = 9) {
  const rows = await prisma.testimonial.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      authorName: true,
      rating: true,
      comment: true,
      travelDate: true,
      trip: { select: { title: true, slug: true } },
    },
  });

  return JSON.parse(JSON.stringify(rows)) as (Omit<(typeof rows)[number], "travelDate"> & {
    travelDate: string | null;
  })[];
}

/** Mirrors GET /api/settings. Missing row (nothing set yet) is not an error. */
export async function getSiteSettings(): Promise<{
  tripNotice: string | null;
  bankDetails: string | null;
}> {
  const row = await prisma.siteSettings.findUnique({ where: { id: "default" } });
  return { tripNotice: row?.tripNotice ?? null, bankDetails: row?.bankDetails ?? null };
}

/** Mirrors GET /api/categories/tree (the public read), including its orphan-promotion rule. */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const all = await prisma.category.findMany({
    select: {
      id: true,
      categoryName: true,
      slug: true,
      description: true,
      image: true,
      parentId: true,
    },
    orderBy: { categoryName: "asc" },
  });
  const tripCounts = await tripCountsByCategory({ publishedOnly: true });

  const byId = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  for (const category of all) {
    byId.set(category.id, {
      id: category.id,
      categoryName: category.categoryName,
      slug: category.slug,
      description: category.description,
      image: category.image,
      parentId: category.parentId,
      tripCount: tripCounts.get(category.id) ?? 0,
      children: [],
    });
  }

  for (const category of all) {
    const node = byId.get(category.id);
    if (!node) continue;

    const parent = category.parentId ? byId.get(category.parentId) : null;

    // A node whose parent row is missing is promoted to root rather than
    // dropped, so a broken parentId can never hide trips from the menu.
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

function flatten(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

/** What the header menu, footer and mobile drawer list: only categories and places with trips in them. */
export function siteNavFrom(trips: Trip[], categories: CategoryNode[]): SiteNav {
  return {
    tripCount: trips.length,
    categories: flatten(categories)
      .filter((category) => category.tripCount > 0)
      .sort((a, b) => b.tripCount - a.tripCount)
      .map((category) => ({
        id: category.id,
        slug: category.slug ?? category.id,
        name: formatCategoryName(category.categoryName),
        count: category.tripCount,
        image: category.image,
      })),
    destinations: destinationCounts(trips),
  };
}

export async function getSiteNav(): Promise<SiteNav> {
  try {
    const [trips, categories] = await Promise.all([getTripSummaries(), getCategoryTree()]);
    return siteNavFrom(trips, categories);
  } catch (error) {
    // The menu must never take a page down with it.
    console.error("Site navigation unavailable:", error);
    return EMPTY_NAV;
  }
}
