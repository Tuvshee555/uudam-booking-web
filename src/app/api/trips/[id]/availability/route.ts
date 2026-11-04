import { NextResponse } from "next/server";

import { prisma, withPrismaRetry } from "@/server/prisma";
import { expireStaleHolds } from "@/server/booking";
import { clientIp, handler, httpError, rateLimit } from "@/server/http";
import { revalidateSeatChanges, revalidateTrips } from "@/server/revalidate";
import { departureDigest } from "@/lib/departureDigest";

type Ctx = { params: Promise<{ id: string }> };

/** Per server instance: a forged or replayed `seen` cannot make this rebuild pages over and over. */
const lastRefresh = new Map<string, number>();
const REFRESH_EVERY_MS = 10 * 60_000;

/**
 * GET /api/trips/:slug/availability?seen=<digest> — public. One trip's dates
 * as they are in the database right now, for the booking panel.
 *
 * The trip page is cached for up to a day and refreshed whenever this app or
 * the chatbot reports a change. This covers what was not reported: a hold that
 * ran out is released first (so the panel shows the seat as free), and when
 * `seen` — the dates the cached page was built with — differs from the
 * database, the trip's pages and the lists are refreshed for the next visitor.
 *
 * The booking itself never trusts this or the page: POST /api/bookings checks
 * the seats again under a row lock. Cached by the CDN for 20 seconds per page
 * version, so a busy page costs one function call every 20 seconds at most.
 */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  rateLimit(`availability:${clientIp(req)}`, { windowMs: 60_000, max: 30 });

  const { id } = await ctx.params;
  const trip = await withPrismaRetry(() =>
    prisma.trip.findFirst({ where: { OR: [{ id }, { slug: id }], isPublished: true }, select: { id: true, slug: true } }),
  );
  if (!trip) throw httpError(404, "Аялал олдсонгүй");

  const { seatChanges } = await expireStaleHolds({ tripId: trip.id });
  revalidateSeatChanges(seatChanges);

  const departures = JSON.parse(JSON.stringify(
    await withPrismaRetry(() => prisma.departure.findMany({ where: { tripId: trip.id }, orderBy: { startDate: "asc" } })),
  ));
  const digest = departureDigest(departures);

  const seen = new URL(req.url).searchParams.get("seen");
  if (seen && seen !== digest && !seatChanges.length && Date.now() - (lastRefresh.get(trip.slug) ?? 0) > REFRESH_EVERY_MS) {
    lastRefresh.set(trip.slug, Date.now());
    revalidateTrips([trip.slug]);
  }

  const res = NextResponse.json({ departures, digest });
  res.headers.set("Cache-Control", "public, max-age=0, s-maxage=20");
  return res;
});
