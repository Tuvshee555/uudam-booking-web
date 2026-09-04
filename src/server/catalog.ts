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
