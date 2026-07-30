import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { handler, httpError, publicCache } from "@/server/http";
import { cached } from "@/server/cache";
import { TRIP_INCLUDE } from "@/server/tripInput";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/categories/:id/trips
 *
 * Returns the category's trips *including every descendant category*, so
 * browsing "Ази" also shows trips filed under "Ази > Япон".
 */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;

  const payload = await cached(`categories:trips:${id}`, 20_000, async () => {
    const categories = await prisma.category.findMany({
      select: { id: true, parentId: true, categoryName: true, slug: true },
    });

    const target = categories.find((c) => c.id === id || c.slug === id);
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
      where: { categoryId: { in: Array.from(ids) }, isPublished: true },
      include: TRIP_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      category: {
        id: target.id,
        categoryName: target.categoryName,
        slug: target.slug,
      },
      trips,
    };
  });

  if (!payload) throw httpError(404, "Ангилал олдсонгүй");

  return publicCache(NextResponse.json(payload));
});
