import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, httpError, json, publicCache, readJson, safeText } from "@/server/http";
import { cached, invalidateCatalog } from "@/server/cache";
import { slugify } from "@/server/tripInput";

/**
 * Free-form trip labels ("Галт тэрэг", "Хямдралтай" …) staff create
 * themselves — starts empty, nothing pre-seeded. Flat, unlike Category:
 * a trip can carry any number of tags at once.
 */

async function listTags() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, _count: { select: { trips: true } } },
  });

  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    tripCount: tag._count.trips,
  }));
}

async function uniqueTagSlug(base: string) {
  let candidate = base;
  let counter = 2;

  for (;;) {
    const existing = await prisma.tag.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

export const GET = handler(async () => {
  const result = await cached("tags:list", 30_000, listTags);
  return publicCache(NextResponse.json(result));
});

export const POST = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);
  const name = safeText(body.name, 80);
  if (!name) throw httpError(400, "Шошгын нэр шаардлагатай");

  const existing = await prisma.tag.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) throw httpError(409, "Ийм нэртэй шошго байна");

  await prisma.tag.create({
    data: { name, slug: await uniqueTagSlug(slugify(name, "tag")) },
  });

  invalidateCatalog();

  return json(await listTags(), { status: 201 });
});

export const PUT = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);
  const id = safeText(body.id, 60);
  if (!id) throw httpError(400, "Шошгын ID шаардлагатай");

  const name = safeText(body.name, 80);
  if (!name) throw httpError(400, "Шошгын нэр шаардлагатай");

  await prisma.tag.update({ where: { id }, data: { name } });
  invalidateCatalog();

  return json(await listTags());
});

export const DELETE = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);
  const id = safeText(body.id, 60);
  if (!id) throw httpError(400, "Шошгын ID шаардлагатай");

  await prisma.tag.delete({ where: { id } });
  invalidateCatalog();

  return json({ success: true });
});
