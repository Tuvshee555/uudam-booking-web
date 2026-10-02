import { NextResponse } from "next/server";

import { requireAdmin } from "@/server/auth";
import { handler, httpError, readJson } from "@/server/http";
import { prisma, withPrismaRetry } from "@/server/prisma";
import { parsePlacesInput, parseStoredWeather, withClimate } from "@/server/weather/places";
import { ensureTripPlaces, loadTripForWeather } from "@/server/weather/tripWeather";

type Ctx = { params: Promise<{ id: string }> };

async function requireTrip(id: string) {
  const trip = await loadTripForWeather({ id });
  if (!trip) throw httpError(404, "Trip not found");
  return trip;
}

/** GET — the stored weather places (detecting them if the trip has none yet). */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin(req);
  const trip = await requireTrip((await ctx.params).id);
  await ensureTripPlaces(trip);
  const fresh = await requireTrip(trip.id);
  return NextResponse.json(parseStoredWeather(fresh.weather));
});

/** POST — re-detect the places from the trip's current text. */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin(req);
  const trip = await requireTrip((await ctx.params).id);
  try {
    await ensureTripPlaces(trip, { redetect: true, throwOnError: true });
  } catch {
    throw httpError(502, "Автоматаар тодорхойлж чадсангүй (AI үйлчилгээ түр ажиллахгүй байна). Байршлаа гараар хайж нэмнэ үү.");
  }
  const fresh = await requireTrip(trip.id);
  return NextResponse.json(parseStoredWeather(fresh.weather));
});

/** PUT {places} — staff-chosen places; marks the list manual so it is never auto-replaced. */
export const PUT = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin(req);
  const trip = await requireTrip((await ctx.params).id);
  const body = await readJson<{ places?: unknown }>(req);
  const input = parsePlacesInput(body.places);
  if (!input) throw httpError(400, "places must be a list");

  // Keep climate already computed for an unchanged place; compute the rest.
  const previous = parseStoredWeather(trip.weather)?.places ?? [];
  const reused = input.map((place) => {
    const same = previous.find((p) => p.lat === place.lat && p.lon === place.lon);
    return same?.climate ? { ...place, climate: same.climate } : place;
  });
  const places = await withClimate(reused);

  const weather = { places, source: "manual" as const, updatedAt: new Date().toISOString() };
  await withPrismaRetry(() => prisma.trip.update({ where: { id: trip.id }, data: { weather } }));
  return NextResponse.json(weather);
});
