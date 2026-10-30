import { NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/server/prisma";
import { handler, json, publicCache } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { cached } from "@/server/cache";
import { tripCountsByCategory } from "@/server/categoryCounts";

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

/**
 * GET /api/categories/tree — nested categories for the mega menu / sidebar.
 *
 * `?all=true` is the admin's read (same convention as /categories/:id/trips):
 * straight from the database with no shared or browser caching, so a category
 * staff just created shows up at once instead of up to half a minute later.
 */
export const GET = handler(async (req: Request) => {
  if (new URL(req.url).searchParams.get("all") === "true") {
    await requireAdmin(req);
    return json(await buildTree());
  }

  const roots = await cached<CategoryTreeNode[]>("categories:tree", 30_000, buildTree);

  return publicCache(NextResponse.json(roots));
});

async function buildTree(): Promise<CategoryTreeNode[]> {
  const all = await withPrismaRetry(() =>
    prisma.category.findMany({
      select: {
        id: true,
        categoryName: true,
        slug: true,
        description: true,
        image: true,
        parentId: true,
      },
      orderBy: { categoryName: "asc" },
    }),
  );
  const tripCounts = await tripCountsByCategory();

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
    else built.push(node);
  }

  return built;
}
