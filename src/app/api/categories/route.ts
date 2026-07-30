import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, httpError, json, publicCache, readJson, safeText } from "@/server/http";
import { cached, invalidateCatalog } from "@/server/cache";
import { slugify } from "@/server/tripInput";

const CATEGORY_SELECT = {
  id: true,
  categoryName: true,
  slug: true,
  description: true,
  image: true,
  parentId: true,
  _count: { select: { trips: true, children: true } },
} as const;

type CategoryRow = {
  id: string;
  categoryName: string;
  slug: string | null;
  description: string | null;
  image: string | null;
  parentId: string | null;
  _count: { trips: number; children: number };
};

function toDto(category: CategoryRow) {
  return {
    id: category.id,
    categoryName: category.categoryName,
    slug: category.slug,
    description: category.description,
    image: category.image,
    parentId: category.parentId,
    tripCount: category._count.trips,
    childrenCount: category._count.children,
    hasChildren: category._count.children > 0,
  };
}

async function listCategories(parentId?: string | null) {
  const where =
    parentId === "root"
      ? { parentId: null }
      : typeof parentId === "string" && parentId.length
        ? { parentId }
        : {};

  const categories = await prisma.category.findMany({
    where,
    select: CATEGORY_SELECT,
    orderBy: { categoryName: "asc" },
  });

  return categories.map(toDto);
}

export const GET = handler(async (req: Request) => {
  const parentId = new URL(req.url).searchParams.get("parentId");

  const result = await cached(`categories:list:${parentId ?? "all"}`, 30_000, () =>
    listCategories(parentId),
  );

  return publicCache(NextResponse.json(result));
});

export const POST = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);
  const categoryName = safeText(body.categoryName, 160);

  if (!categoryName) throw httpError(400, "Ангиллын нэр шаардлагатай");

  const parentId = safeText(body.parentId, 60);

  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) throw httpError(400, "Эцэг ангилал олдсонгүй");
  }

  await prisma.category.create({
    data: {
      categoryName,
      parentId,
      slug: await uniqueCategorySlug(slugify(categoryName, "category")),
      description: safeText(body.description, 1000),
      image: safeText(body.image, 800),
    },
  });

  invalidateCatalog();

  return json(await listCategories());
});

export const PUT = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);
  const id = safeText(body.id, 60);

  if (!id) throw httpError(400, "Ангиллын ID шаардлагатай");

  const parentId = body.parentId === undefined ? undefined : safeText(body.parentId, 60);

  if (parentId === id) throw httpError(400, "Ангилал өөрийгөө эцэг болгож болохгүй");

  // Walking up the new parent's chain stops an admin from creating a cycle
  // (A -> B -> A), which would hang every tree render.
  if (parentId) {
    let cursor: string | null = parentId;
    const seen = new Set<string>();

    while (cursor) {
      if (cursor === id) throw httpError(400, "Ангиллын мөчир давхцаж байна");
      if (seen.has(cursor)) break;
      seen.add(cursor);

      const parent: { parentId: string | null } | null = await prisma.category.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }

  const category = await prisma.category.update({
    where: { id },
    data: {
      categoryName: safeText(body.categoryName, 160) ?? undefined,
      description: body.description === undefined ? undefined : safeText(body.description, 1000),
      image: body.image === undefined ? undefined : safeText(body.image, 800),
      ...(parentId === undefined ? {} : { parentId }),
    },
  });

  invalidateCatalog();

  return json({ success: true, category });
});

export const DELETE = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);
  const id = safeText(body.id, 60);

  if (!id) throw httpError(400, "Ангиллын ID шаардлагатай");

  const [tripCount, childCount] = await Promise.all([
    prisma.trip.count({ where: { categoryId: id } }),
    prisma.category.count({ where: { parentId: id } }),
  ]);

  if (childCount > 0) throw httpError(409, "Дэд ангилалтай тул устгах боломжгүй");

  // Detach trips rather than cascade-deleting them: losing a category must
  // never take the agency's trips with it.
  if (tripCount > 0) {
    await prisma.trip.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
  }

  await prisma.category.delete({ where: { id } });
  invalidateCatalog();

  return json({ success: true, detachedTrips: tripCount });
});

async function uniqueCategorySlug(base: string) {
  let candidate = base;
  let counter = 2;

  for (;;) {
    const existing = await prisma.category.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${counter}`;
    counter += 1;
  }
}
