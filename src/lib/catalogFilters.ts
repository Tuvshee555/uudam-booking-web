import type { Trip } from "@/types/trip";
import { availability, startingPrice, upcomingDepartures } from "./departures";
import { departureDateKey } from "./departureDate.js";
import { fold, tripDestinations } from "./destinations";
import { hasKnownTripPrice } from "./pricing";
import { isSaleTrip } from "./tripMarketing";

/**
 * The catalogue's search, filters and sort as one pure module, so the page,
 * the URL and the tests all agree on what "7–8 хоног, 11-р сар" means.
 *
 * Everything filters what the visitor can act on: dates are upcoming
 * departures in Ulaanbaatar time, the price is the "-с эхлэн" price (the
 * cheapest date still open), and "available" means at least one open date.
 */

export type SortKey = "recommended" | "soonest" | "price-asc" | "price-desc" | "duration-asc" | "duration-desc" | "newest";

export const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "Санал болгох" },
  { key: "soonest", label: "Ойрын огноо" },
  { key: "price-asc", label: "Үнэ: багаас их" },
  { key: "price-desc", label: "Үнэ: ихээс бага" },
  { key: "duration-asc", label: "Хугацаа: богино" },
  { key: "duration-desc", label: "Хугацаа: урт" },
  { key: "newest", label: "Шинээр нэмэгдсэн" },
];

export const DURATIONS = [
  { key: "short", label: "6 хүртэл хоног", min: 1, max: 6 },
  { key: "mid", label: "7–8 хоног", min: 7, max: 8 },
  { key: "long", label: "9+ хоног", min: 9, max: Number.POSITIVE_INFINITY },
] as const;

export type PriceRange = { key: string; label: string; min: number; max: number };

/** Used when staff have defined no price bands of their own (admin → Үнийн ангилал). */
export const PRICES: PriceRange[] = [
  { key: "under-2m", label: "2 сая хүртэл", min: 0, max: 2_000_000 },
  { key: "2m-4m", label: "2–4 сая", min: 2_000_000, max: 4_000_000 },
  { key: "4m-6m", label: "4–6 сая", min: 4_000_000, max: 6_000_000 },
  { key: "over-6m", label: "6 саяас дээш", min: 6_000_000, max: Number.POSITIVE_INFINITY },
];

/** Staff-authored bands, when there are any, replace the default ranges. */
export function priceRangesFrom(bands: { id: string; name: string; minPrice: number; maxPrice: number | null }[]): PriceRange[] {
  return bands.length
    ? bands.map((band) => ({ key: band.id, label: band.name, min: band.minPrice, max: band.maxPrice ?? Number.POSITIVE_INFINITY }))
    : PRICES;
}

export type CatalogFilters = {
  q: string;
  destinations: string[];
  categories: string[];
  months: string[];
  durations: string[];
  price: string | null;
  tags: string[];
  available: boolean;
  sale: boolean;
  featured: boolean;
  sort: SortKey;
};

export function emptyFilters(): CatalogFilters {
  return { q: "", destinations: [], categories: [], months: [], durations: [], price: null, tags: [], available: false, sale: false, featured: false, sort: "recommended" };
}

type Params = { get(name: string): string | null };

const list = (value: string | null) => (value ? value.split(",").map((item) => item.trim()).filter(Boolean) : []);
const flag = (value: string | null) => value === "1" || value === "true";

/** Reads the URL, including the parameter names older shared links used. */
export function filtersFromParams(params: Params, prices: PriceRange[] = PRICES): CatalogFilters {
  const sort = params.get("sort");
  const durations = list(params.get("dur"));
  const legacyDuration = params.get("duration");
  const price = params.get("price") ?? params.get("band");
  return {
    q: (params.get("q") ?? "").slice(0, 120),
    destinations: list(params.get("dest")),
    categories: [...list(params.get("cat")), ...list(params.get("category"))],
    months: list(params.get("month")).filter((month) => /^\d{4}-\d{2}$/.test(month)),
    durations: [...durations, ...(legacyDuration === "1-4" ? ["short"] : legacyDuration === "5-7" ? ["mid"] : legacyDuration === "8+" ? ["long"] : [])]
      .filter((key) => DURATIONS.some((entry) => entry.key === key)),
    price: prices.some((entry) => entry.key === price) ? price : null,
    tags: list(params.get("tags")),
    available: flag(params.get("avail")),
    sale: flag(params.get("sale")),
    featured: flag(params.get("featured")),
    sort: SORTS.some((entry) => entry.key === sort) ? (sort as SortKey) : "recommended",
  };
}

export function filtersToQuery(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.destinations.length) params.set("dest", filters.destinations.join(","));
  if (filters.categories.length) params.set("cat", filters.categories.join(","));
  if (filters.months.length) params.set("month", filters.months.join(","));
  if (filters.durations.length) params.set("dur", filters.durations.join(","));
  if (filters.price) params.set("price", filters.price);
  if (filters.tags.length) params.set("tags", filters.tags.join(","));
  if (filters.available) params.set("avail", "1");
  if (filters.sale) params.set("sale", "1");
  if (filters.featured) params.set("featured", "1");
  if (filters.sort !== "recommended") params.set("sort", filters.sort);
  return params.toString();
}

export function activeFilterCount(filters: CatalogFilters): number {
  return (
    (filters.q.trim() ? 1 : 0) +
    filters.destinations.length +
    filters.categories.length +
    filters.months.length +
    filters.durations.length +
    (filters.price ? 1 : 0) +
    filters.tags.length +
    (filters.available ? 1 : 0) +
    (filters.sale ? 1 : 0) +
    (filters.featured ? 1 : 0)
  );
}

type CatalogTrip = Pick<
  Trip,
  "id" | "title" | "summary" | "country" | "city" | "destinations" | "durationDays" | "price" | "departures" | "categoryId" | "categories" | "tags" | "isFeatured" | "createdAt" | "discount" | "sourceMetadata"
>;

/** Months ("YYYY-MM", Ulaanbaatar) with an upcoming departure that is still open. */
export function openMonths(trip: CatalogTrip, now: number): string[] {
  return [...new Set(
    upcomingDepartures(trip as Trip, now)
      .filter((departure) => availability(departure).selectable)
      .map((departure) => departureDateKey(departure.startDate).slice(0, 7)),
  )];
}

export function hasOpenDeparture(trip: CatalogTrip, now: number): boolean {
  return upcomingDepartures(trip as Trip, now).some((departure) => availability(departure).selectable);
}

function categoryIds(trip: CatalogTrip): string[] {
  return [trip.categoryId, ...trip.categories.map((category) => category.id)].filter((id): id is string => Boolean(id));
}

function searchText(trip: CatalogTrip): string {
  return fold([
    trip.title,
    trip.summary,
    trip.country,
    trip.city,
    ...(trip.destinations ?? []),
    ...tripDestinations(trip).flatMap((destination) => [destination.label, destination.country, ...destination.terms]),
    ...trip.categories.map((category) => category.categoryName),
    ...trip.tags.map((tag) => tag.name),
  ].filter(Boolean).join(" "));
}

export function matchesQuery(trip: CatalogTrip, query: string): boolean {
  const words = fold(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const text = searchText(trip);
  return words.every((word) => text.includes(word));
}

type Facet = "destinations" | "categories" | "months" | "durations" | "price" | "tags" | "available" | "sale" | "featured";

/** Whether a trip passes every active filter, optionally ignoring one facet (for that facet's own counts). */
export function tripMatches(trip: CatalogTrip, filters: CatalogFilters, now: number, ignore?: Facet, prices: PriceRange[] = PRICES): boolean {
  if (!matchesQuery(trip, filters.q)) return false;
  if (ignore !== "destinations" && filters.destinations.length) {
    const keys = tripDestinations(trip).map((destination) => destination.key);
    if (!filters.destinations.some((key) => keys.includes(key))) return false;
  }
  if (ignore !== "categories" && filters.categories.length) {
    const ids = categoryIds(trip);
    if (!filters.categories.some((id) => ids.includes(id))) return false;
  }
  if (ignore !== "months" && filters.months.length) {
    const months = openMonths(trip, now);
    if (!filters.months.some((month) => months.includes(month))) return false;
  }
  if (ignore !== "durations" && filters.durations.length) {
    const inBucket = DURATIONS.filter((entry) => filters.durations.includes(entry.key))
      .some((entry) => trip.durationDays >= entry.min && trip.durationDays <= entry.max);
    if (!inBucket) return false;
  }
  if (ignore !== "price" && filters.price) {
    const range = prices.find((entry) => entry.key === filters.price);
    const amount = startingPrice(trip as Trip, now);
    if (range && (!hasKnownTripPrice(amount) || amount < range.min || amount >= range.max)) return false;
  }
  if (ignore !== "tags" && filters.tags.length && !trip.tags.some((tag) => filters.tags.includes(tag.id))) return false;
  if (ignore !== "available" && filters.available && !hasOpenDeparture(trip, now)) return false;
  if (ignore !== "sale" && filters.sale && !isSaleTrip(trip as Trip)) return false;
  if (ignore !== "featured" && filters.featured && !trip.isFeatured) return false;
  return true;
}

function nextOpenTime(trip: CatalogTrip, now: number): number {
  const next = upcomingDepartures(trip as Trip, now).find((departure) => availability(departure).selectable);
  return next ? new Date(next.startDate).getTime() : Number.POSITIVE_INFINITY;
}

function priceOrLast(trip: CatalogTrip, now: number, direction: 1 | -1): number {
  const amount = startingPrice(trip as Trip, now);
  if (!hasKnownTripPrice(amount)) return Number.POSITIVE_INFINITY;
  return amount * direction;
}

export function sortTrips<T extends CatalogTrip>(trips: T[], sort: SortKey, now: number): T[] {
  const sorted = [...trips];
  const created = (trip: CatalogTrip) => new Date(trip.createdAt).getTime();
  switch (sort) {
    case "soonest":
      return sorted.sort((a, b) => nextOpenTime(a, now) - nextOpenTime(b, now));
    case "price-asc":
      return sorted.sort((a, b) => priceOrLast(a, now, 1) - priceOrLast(b, now, 1));
    case "price-desc":
      return sorted.sort((a, b) => priceOrLast(a, now, -1) - priceOrLast(b, now, -1));
    case "duration-asc":
      return sorted.sort((a, b) => a.durationDays - b.durationDays || nextOpenTime(a, now) - nextOpenTime(b, now));
    case "duration-desc":
      return sorted.sort((a, b) => b.durationDays - a.durationDays || nextOpenTime(a, now) - nextOpenTime(b, now));
    case "newest":
      return sorted.sort((a, b) => created(b) - created(a));
    default:
      // Featured first, then whatever leaves soonest, then the newest.
      return sorted.sort((a, b) =>
        Number(b.isFeatured) - Number(a.isFeatured) ||
        nextOpenTime(a, now) - nextOpenTime(b, now) ||
        created(b) - created(a));
  }
}

export type FacetOption = { key: string; label: string; count: number };

export type CatalogFacets = {
  destinations: FacetOption[];
  categories: FacetOption[];
  months: FacetOption[];
  durations: FacetOption[];
  prices: FacetOption[];
  tags: FacetOption[];
  available: number;
  sale: number;
};

/**
 * Every option with the number of trips it would show given the other active
 * filters, so a visitor never picks a filter that empties the page without
 * seeing "0" next to it first.
 */
export function catalogFacets(
  trips: CatalogTrip[],
  filters: CatalogFilters,
  now: number,
  labels: { categories: Map<string, string>; tags: Map<string, string>; month: (key: string) => string },
  prices: PriceRange[] = PRICES,
): CatalogFacets {
  const pool = (facet: Facet) => trips.filter((trip) => tripMatches(trip, filters, now, facet, prices));
  const tally = (facet: Facet, keysOf: (trip: CatalogTrip) => string[]) => {
    const counts = new Map<string, number>();
    for (const trip of pool(facet)) for (const key of new Set(keysOf(trip))) counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  };

  const destinationCounts = tally("destinations", (trip) => tripDestinations(trip).map((destination) => destination.key));
  const destinationLabels = new Map(trips.flatMap((trip) => tripDestinations(trip).map((destination) => [destination.key, destination.label] as const)));
  const categoryCounts = tally("categories", categoryIds);
  const monthCounts = tally("months", (trip) => openMonths(trip, now));
  const durationCounts = tally("durations", (trip) => DURATIONS.filter((entry) => trip.durationDays >= entry.min && trip.durationDays <= entry.max).map((entry) => entry.key));
  const priceCounts = tally("price", (trip) => {
    const amount = startingPrice(trip as Trip, now);
    return hasKnownTripPrice(amount) ? prices.filter((entry) => amount >= entry.min && amount < entry.max).map((entry) => entry.key) : [];
  });
  const tagCounts = tally("tags", (trip) => trip.tags.map((tag) => tag.id));

  const options = (counts: Map<string, number>, label: (key: string) => string | undefined) =>
    [...counts].flatMap(([key, count]) => {
      const text = label(key);
      return text ? [{ key, label: text, count }] : [];
    });

  return {
    destinations: options(destinationCounts, (key) => destinationLabels.get(key)).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "mn")),
    categories: options(categoryCounts, (key) => labels.categories.get(key)).sort((a, b) => b.count - a.count),
    months: options(monthCounts, labels.month).sort((a, b) => a.key.localeCompare(b.key)),
    durations: DURATIONS.map((entry) => ({ key: entry.key, label: entry.label, count: durationCounts.get(entry.key) ?? 0 })),
    prices: prices.map((entry) => ({ key: entry.key, label: entry.label, count: priceCounts.get(entry.key) ?? 0 })),
    tags: options(tagCounts, (key) => labels.tags.get(key)).sort((a, b) => b.count - a.count),
    available: pool("available").filter((trip) => hasOpenDeparture(trip, now)).length,
    sale: pool("sale").filter((trip) => isSaleTrip(trip as Trip)).length,
  };
}
