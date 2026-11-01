import { prisma } from "./prisma";

/**
 * Counts trips against their primary category and any extra storefront
 * categories. A Set per trip avoids double-counting when the primary category
 * is also present in the many-to-many list.
 *
 * `publishedOnly` is what visitors see: counting drafts made the menu promise
 * "14 аялал" for a category that listed 8.
 */
export async function tripCountsByCategory({ publishedOnly = false }: { publishedOnly?: boolean } = {}) {
  const trips = await prisma.trip.findMany({
    where: publishedOnly ? { isPublished: true } : undefined,
    select: {
      categoryId: true,
      categories: { select: { id: true } },
    },
  });

  const counts = new Map<string, number>();

  for (const trip of trips) {
    const categoryIds = new Set([
      trip.categoryId,
      ...trip.categories.map((category) => category.id),
    ].filter((id): id is string => Boolean(id)));

    for (const id of categoryIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return counts;
}
