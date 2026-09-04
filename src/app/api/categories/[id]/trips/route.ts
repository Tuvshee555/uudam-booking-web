import { NextResponse } from "next/server";
import { handler, httpError, publicCache, json } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { cached } from "@/server/cache";
import { getCategoryWithTrips } from "@/server/catalog";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/categories/:id/trips
 *
 * Returns the category's trips *including every descendant category*, so
 * browsing "Ази" also shows trips filed under "Ази > Япон".
 *
 * `?all=true` additionally includes unpublished trips — admin-gated, since
 * the public category page must never leak drafts. Without this the admin's
 * own category browser disagreed with the category tree's own trip count:
 * the count includes drafts, this list didn't, so a category showing "3
 * аялал" would only list 2.
 */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const includeDrafts = new URL(req.url).searchParams.get("all") === "true";

  if (includeDrafts) {
    await requireAdmin(req);
    const payload = await getCategoryWithTrips(id, { includeDrafts: true });
    if (!payload) throw httpError(404, "Ангилал олдсонгүй");
    return json({ success: true, ...payload });
  }

  const payload = await cached(`categories:trips:${id}`, 20_000, () => getCategoryWithTrips(id));

  if (!payload) throw httpError(404, "Ангилал олдсонгүй");

  return publicCache(NextResponse.json({ success: true, ...payload }));
});
