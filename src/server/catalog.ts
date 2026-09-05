import { prisma } from "@/server/prisma";
import { TRIP_INCLUDE } from "@/server/tripInput";
import type { CategoryNode, Trip } from "@/types/trip";

/**
 * Server-side reads of the public catalogue, shaped exactly like the API
 * responses so pages can seed their client queries with them.
 *
 * `NextResponse.json` turns Dates into ISO strings and the client `Trip` type
 * expects strings, so every result goes through the same JSON round-trip the
 * wire would have applied. Without that the hydrated value and a later refetch
 * would disagree.
 */

export async function getPublishedTrips(): Promise<Trip[]> {
  const trips = await prisma.trip.findMany({
    where: { isPublished: true },
    include: TRIP_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return JSON.parse(JSON.stringify(trips)) as Trip[];
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
    select: { id: true, parentId: true, categoryName: true, slug: true },
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

  const trips = await prisma.trip.findMany({
    where: {
      categoryId: { in: Array.from(ids) },
      ...(includeDrafts ? {} : { isPublished: true }),
    },
    include: TRIP_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return {
    category: { id: target.id, categoryName: target.categoryName, slug: target.slug },
    trips: JSON.parse(JSON.stringify(trips)) as Trip[],
  };
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

/** Mirrors GET /api/categories/tree, including its orphan-promotion rule. */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const all = await prisma.category.findMany({
    select: {
      id: true,
      categoryName: true,
      slug: true,
      description: true,
      image: true,
      parentId: true,
      _count: { select: { trips: true } },
    },
    orderBy: { categoryName: "asc" },
  });

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
      tripCount: category._count.trips,
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
