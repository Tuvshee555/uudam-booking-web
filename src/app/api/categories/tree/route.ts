import { NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/server/prisma";
import { handler, publicCache } from "@/server/http";
import { cached } from "@/server/cache";

export type CategoryTreeNode = {
  id: string;
  categoryName: string;
  slug: string | null;
  description: string | null;
  image: string | null;
  parentId: string | null;
  tripCount: number;
  children: CategoryTreeNode[];
};

/** GET /api/categories/tree — nested categories for the mega menu / sidebar. */
export const GET = handler(async () => {
  const roots = await cached<CategoryTreeNode[]>("categories:tree", 30_000, async () => {
    const all = await withPrismaRetry(() =>
      prisma.category.findMany({
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
      }),
    );

    const byId = new Map<string, CategoryTreeNode>();
    const built: CategoryTreeNode[] = [];

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
      else built.push(node);
    }

    return built;
  });

  return publicCache(NextResponse.json(roots));
});
