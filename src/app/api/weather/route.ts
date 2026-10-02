import { NextResponse } from "next/server";

import { optionalAdmin } from "@/server/auth";
import { clientIp, handler, httpError, publicCache, rateLimit } from "@/server/http";
import { loadTripForWeather, ensureTripPlaces, buildTripWeatherReport } from "@/server/weather/tripWeather";

/**
 * GET /api/weather?trip=<id|slug>   — the trip page's weather card
 * GET /api/weather?source=<id>      — the Messenger bot, by its own trip id
 *   &date=YYYY-MM-DD                 — which departure (default: the next one)
 *
 * One endpoint, one computation: the card and the chatbot read the same
 * report (the bot sends `text` verbatim), so they can never disagree.
 */
export const GET = handler(async (req: Request) => {
  rateLimit(`weather:${clientIp(req)}`, { windowMs: 60_000, max: 60 });

  const params = new URL(req.url).searchParams;
  const tripKey = params.get("trip")?.trim().slice(0, 200);
  const source = params.get("source")?.trim().slice(0, 200);
  const date = params.get("date")?.trim();
  if (!tripKey && !source) throw httpError(400, "trip or source is required");

  const trip = await loadTripForWeather(
    source ? { sourceTripId: source } : { id: tripKey, slug: tripKey },
  );
  // Drafts stay private on the storefront; the bot addresses trips by its
  // own id, which is never shown publicly.
  if (!trip || (!source && !trip.isPublished && !(await optionalAdmin(req)))) {
    throw httpError(404, "Trip not found");
  }

  const stored = await ensureTripPlaces(trip);
  const report = await buildTripWeatherReport(trip, stored, date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined);
  // Forecasts refresh every ~30 min upstream; let the CDN absorb repeat views.
  return publicCache(NextResponse.json(report), 600, 1800);
});
