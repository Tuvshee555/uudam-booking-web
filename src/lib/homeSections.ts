import type { Departure, Trip } from "@/types/trip";
import { availability, startingPrice, upcomingDepartures } from "./departures";
import { tripDestinations, type Destination } from "./destinations";
import { hasKnownTripPrice } from "./pricing";

/**
 * What the home page shows, chosen from the live catalogue. Pure functions
 * over trip summaries so the choices are testable and never stale: a trip
 * that is unpublished or sells out drops out of every section on its own.
 */

/**
 * Hero photography, in order of preference: trips staff mark as featured,
 * then these trips — chosen for photographs that hold a full-width frame
 * (all 1600–2600 px wide, verified) and for showing the range of places the
 * agency sells. A trip that is no longer published is simply skipped.
 */
export const HERO_TRIP_PREFERENCE = [
  "trip-ade46028fe74797d2eb7", // Бали — Kelingking beach
  "trip-5e427ff6ef0e066517eb", // Япон — Chureito pagoda and Fuji
  "janjiajie-gazar-nisleg-hosolson-ayalal", // Жанжиажэ — the pillar forest
  "trip-623a01ce8f23f5270828", // Хайнан — Sanya bay from the air
  "trip-d2672bb7143b340abc61", // Тайланд — Grand Palace, Bangkok
  "trip-a8443b76ac27a5cee9a4", // Чунчин — Hongyadong at night
];

export type HeroSlide = {
  image: string;
  trip: {
    slug: string;
    title: string;
    durationDays: number;
    durationNights: number;
    price: number | null;
    place: string | null;
  } | null;
};

function slideFor(trip: Trip, now: number): HeroSlide {
  const price = startingPrice(trip, now);
  return {
    image: trip.image,
    trip: {
      slug: trip.slug,
      title: trip.title,
      durationDays: trip.durationDays,
      durationNights: trip.durationNights ?? 0,
      price: hasKnownTripPrice(price) ? price : null,
      place: tripDestinations(trip)[0]?.label ?? null,
    },
  };
}

export function heroSlides(trips: Trip[], now: number, adminImages: string[] = [], limit = 5): HeroSlide[] {
  const withImage = trips.filter((trip) => Boolean(trip.image));
  if (adminImages.length) {
    // Staff chose these photos; caption one only when it is a live trip's cover.
    return adminImages.slice(0, limit).map((image) => {
      const trip = withImage.find((candidate) => candidate.image === image);
      return trip ? slideFor(trip, now) : { image, trip: null };
    });
  }
  const featured = withImage.filter((trip) => trip.isFeatured);
  const preferred = HERO_TRIP_PREFERENCE.flatMap((slug) => withImage.filter((trip) => trip.slug === slug));
  const chosen: Trip[] = [];
  const add = (pool: Trip[]) => {
    for (const trip of pool) {
      if (chosen.length >= limit) break;
      if (!chosen.some((existing) => existing.id === trip.id || existing.image === trip.image)) chosen.push(trip);
    }
  };
  add([...featured, ...preferred]);
  // Any other cover only when the chosen ones are gone: some are small uploads
  // that blur at full width.
  if (chosen.length < 2) add(withImage);
  return chosen.map((trip) => slideFor(trip, now));
}

export type DepartureRow = { trip: Trip; departure: Departure; price: number | null; tight: boolean };

/** The next open date of each trip, soonest first — one row per trip so one busy route can't fill the list. */
export function nextDeparturesByTrip(trips: Trip[], now: number, limit = 6): DepartureRow[] {
  const rows: DepartureRow[] = [];
  for (const trip of trips) {
    const departure = upcomingDepartures(trip, now).find((candidate) => availability(candidate).selectable);
    if (!departure) continue;
    const price = departure.price ?? trip.price;
    rows.push({ trip, departure, price: hasKnownTripPrice(price) ? price : null, tight: availability(departure).tone === "tight" });
  }
  return rows
    .sort((a, b) => new Date(a.departure.startDate).getTime() - new Date(b.departure.startDate).getTime())
    .slice(0, limit);
}

/** Open departures in the next `days` days, across the catalogue. */
export function openDepartureCount(trips: Trip[], now: number, days: number): number {
  const until = now + days * 24 * 60 * 60 * 1000;
  return trips.reduce(
    (sum, trip) => sum + upcomingDepartures(trip, now).filter((departure) => availability(departure).selectable && new Date(departure.startDate).getTime() <= until).length,
    0,
  );
}

export type DestinationTile = {
  destination: Destination;
  count: number;
  image: string;
  fromPrice: number | null;
};

/**
 * Which trip's cover best pictures a place, where one trip's photo says it
 * better than the automatic pick (the Great Wall for Beijing, Dazhao Temple
 * for Hohhot). Missing or unpublished trips fall back to the automatic choice.
 */
export const TILE_COVER_PREFERENCE: Record<string, string[]> = {
  beijing: ["trip-03e8d0bc6d40372ff87e"],
  "inner-mongolia": ["jinin-hoh-hot-ordos-hotyn-eruul-mendiin-shinjilgeetei-ayalal"],
  hainan: ["trip-02b2cb0909c57528b082", "trip-b7a3c8a5e598ac191d22"],
  thailand: ["trip-1c67331e1d858b17b0e4", "trip-422d6aae75fae0d05fac"],
};

const DAY_MS = 24 * 60 * 60 * 1000;

function openDeparturesWithin(trip: Trip, now: number, days: number): number {
  return upcomingDepartures(trip, now).filter((departure) =>
    availability(departure).selectable && new Date(departure.startDate).getTime() <= now + days * DAY_MS).length;
}

/**
 * One tile per destination, ordered by how many open departures it has in the
 * next four months (what a visitor can actually book soon), each with a photo
 * from one of its own trips and the lowest "-с эхлэн" price among them. A
 * photo is never repeated across tiles, and photos already in `avoid` (the
 * hero) are used only when a place has nothing else.
 */
export function destinationTiles(trips: Trip[], now: number, limit = 7, avoid: string[] = []): DestinationTile[] {
  const groups = new Map<string, { destination: Destination; trips: Trip[] }>();
  for (const trip of trips) {
    for (const destination of tripDestinations(trip)) {
      const group = groups.get(destination.key) ?? { destination, trips: [] };
      group.trips.push(trip);
      groups.set(destination.key, group);
    }
  }

  const bookableSoon = (group: Trip[]) => group.reduce((sum, trip) => sum + openDeparturesWithin(trip, now, 120), 0);
  const ordered = [...groups.values()].sort((a, b) => bookableSoon(b.trips) - bookableSoon(a.trips) || b.trips.length - a.trips.length);

  const used = new Set<string>();
  const avoided = new Set(avoid);
  const tiles: DestinationTile[] = [];
  for (const { destination, trips: group } of ordered) {
    if (tiles.length >= limit) break;
    const preferred = (TILE_COVER_PREFERENCE[destination.key] ?? []).flatMap((slug) => group.filter((trip) => trip.slug === slug));
    // Otherwise a trip that goes only here (a multi-country cruise photo would
    // misrepresent one place), and one that is still bookable.
    const ranked = [...group].sort((a, b) =>
      Number(tripDestinations(a).length > 1) - Number(tripDestinations(b).length > 1) ||
      Number(openDeparturesWithin(a, now, 365) === 0) - Number(openDeparturesWithin(b, now, 365) === 0));
    const candidates = [...preferred, ...ranked].filter((trip) => trip.image && !used.has(trip.image));
    const cover = candidates.find((trip) => !avoided.has(trip.image)) ?? candidates[0];
    if (!cover) continue;
    used.add(cover.image);
    const prices = group.map((trip) => startingPrice(trip, now)).filter(hasKnownTripPrice);
    tiles.push({ destination, count: group.length, image: cover.image, fromPrice: prices.length ? Math.min(...prices) : null });
  }
  return tiles;
}
