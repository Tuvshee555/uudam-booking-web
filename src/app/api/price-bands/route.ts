import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, httpError, json, publicCache, readJson, safeText } from "@/server/http";
import { cached, invalidateCatalog } from "@/server/cache";
import { toOptionalNumber } from "@/server/tripInput";

/**
 * Named, admin-authored price ranges ("0–1 сая", "2 сая+"). Deliberately not
 * linked to any trip: the storefront buckets a trip into a band by comparing
 * its *current* price against the range at read time, so editing a trip's
 * price can never leave it sitting in a stale band.
 */

function toDto(band: {
  id: string;
  name: string;
  minPrice: number;
  maxPrice: number | null;
  sortOrder: number;
}) {
  return band;
}

async function listBands() {
  const bands = await prisma.priceBand.findMany({ orderBy: { sortOrder: "asc" } });
  return bands.map(toDto);
}

export const GET = handler(async () => {
  const result = await cached("priceBands:list", 30_000, listBands);
  return publicCache(NextResponse.json(result));
});

export const POST = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);
  const name = safeText(body.name, 80);
  if (!name) throw httpError(400, "Нэр шаардлагатай");

  const minPrice = toOptionalNumber(body.minPrice) ?? 0;
  const maxPrice = toOptionalNumber(body.maxPrice) ?? null;

  if (maxPrice !== null && maxPrice <= minPrice) {
    throw httpError(400, "Дээд үнэ доод үнээс их байх ёстой");
  }

  const last = await prisma.priceBand.findFirst({ orderBy: { sortOrder: "desc" } });

  await prisma.priceBand.create({
    data: { name, minPrice, maxPrice, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });

  invalidateCatalog();

  return json(await listBands(), { status: 201 });
});

export const PUT = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);
  const id = safeText(body.id, 60);
  if (!id) throw httpError(400, "ID шаардлагатай");

  const name = body.name === undefined ? undefined : (safeText(body.name, 80) ?? undefined);
  const minPrice = body.minPrice === undefined ? undefined : (toOptionalNumber(body.minPrice) ?? 0);
  const maxPrice = body.maxPrice === undefined ? undefined : (toOptionalNumber(body.maxPrice) ?? null);
  const sortOrder = body.sortOrder === undefined ? undefined : Math.trunc(Number(body.sortOrder));

  if (
    maxPrice !== undefined &&
    maxPrice !== null &&
    (minPrice ?? (await prisma.priceBand.findUnique({ where: { id } }))?.minPrice ?? 0) >= maxPrice
  ) {
    throw httpError(400, "Дээд үнэ доод үнээс их байх ёстой");
  }

  await prisma.priceBand.update({
    where: { id },
    data: { name, minPrice, maxPrice, sortOrder },
  });

  invalidateCatalog();

  return json(await listBands());
});

export const DELETE = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);
  const id = safeText(body.id, 60);
  if (!id) throw httpError(400, "ID шаардлагатай");

  await prisma.priceBand.delete({ where: { id } });
  invalidateCatalog();

  return json({ success: true });
});
