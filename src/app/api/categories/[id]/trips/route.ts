import { NextResponse } from "next/server";
import { handler, httpError, publicCache } from "@/server/http";
import { cached } from "@/server/cache";
import { getCategoryWithTrips } from "@/server/catalog";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/categories/:id/trips
 *
 * Returns the category's trips *including every descendant category*, so
 * browsing "Ази" also shows trips filed under "Ази > Япон".
 */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;

  const payload = await cached(`categories:trips:${id}`, 20_000, () => getCategoryWithTrips(id));

  if (!payload) throw httpError(404, "Ангилал олдсонгүй");

  return publicCache(NextResponse.json({ success: true, ...payload }));
});
