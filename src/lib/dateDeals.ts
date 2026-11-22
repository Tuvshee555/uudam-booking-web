import type { Departure, Trip } from "@/types/trip";
import { availability, startingPrice } from "./departures";
import { departureDateKey } from "./departureDate.js";

/**
 * Staff's per-date deals (2026-11-22): a sale fare and an «Онцлох» flag on ONE
 * departure date, set in either admin. Stored as Departure.salePrice /
 * saleChildPrice / isFeatured; the regular fare stays in Departure.price (or
 * the trip's) so clearing the sale brings it straight back.
 *
 * Applied on every public read, for every brand, before the brand's own fares
 * (lib/brandTrip.ts):
 *   - a date whose sale is lower than its regular fare sells at the sale fare:
 *     `price`/`childPrice` become the sale fares, the regular ones move to
 *     `originalPrice`/`originalChildPrice`, and `salePercent` says how much is off.
 *     Booking totals and enquiry estimates read `price`, so they charge the sale.
 *   - a trip with an upcoming, bookable date marked «Онцлох» is featured, and
 *     lists those dates in `featuredDates`.
 *   - a trip with no sale of its own shows the deepest date sale as its badge
 *     (`discount`), and strikes through its old "from" price (`oldPrice`) only
 *     when the card's "-с эхлэн" price really is a sale date's fare.
 *
 * Pure and copy-on-write, and idempotent: a date that already carries
 * `originalPrice` is left as it is, so running it twice changes nothing.
 */

type Json = Record<string, unknown>;

/** Below this a typed figure is a placeholder, not a fare (tripPriceOptions isRealFare). */
const MIN_SALE_FARE = 1000;

function isObject(value: unknown): value is Json {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** The whole percent a sale takes off: 3,290,000₮ → 2,990,000₮ is 9. */
export function salePercentOf(regular: number, sale: number): number {
  return Math.round(((regular - sale) / regular) * 100);
}

/** A sale fare that counts: a real figure, lower than the regular fare. */
export function effectiveSale(regular: unknown, sale: unknown): sale is number {
  return positive(regular) && positive(sale) && sale >= MIN_SALE_FARE && sale < regular;
}

/** One date with its sale applied; the same object when it has none (or already has it). */
export function dealDeparture<D>(departure: D, trip: { price?: unknown; childPrice?: unknown }): D {
  if (!isObject(departure)) return departure;
  if (typeof departure.originalPrice === "number" || typeof departure.originalChildPrice === "number") return departure;
  const adult = departure.price ?? trip.price;
  const child = departure.childPrice ?? trip.childPrice;
  const adultSale = effectiveSale(adult, departure.salePrice);
  const childSale = effectiveSale(child, departure.saleChildPrice);
  if (!adultSale && !childSale) return departure;
  const out: Json = { ...departure };
  if (adultSale) {
    out.price = departure.salePrice;
    out.originalPrice = adult;
    out.salePercent = salePercentOf(adult as number, departure.salePrice as number);
  }
  if (childSale) {
    out.childPrice = departure.saleChildPrice;
    out.originalChildPrice = child;
  }
  return out as D;
}

/** Still ahead (today counts, Ulaanbaatar calendar) and open for booking. */
function bookableAhead(departure: Json, today: string): boolean {
  if (!departure.startDate || !departure.status) return false;
  return departureDateKey(departure.startDate as string) >= today && availability(departure as unknown as Departure).selectable;
}

function hasOwnSale(trip: Json): boolean {
  if (trip.saleFromDates === true) return false;
  return positive(trip.discount) || (positive(trip.oldPrice) && positive(trip.price) && trip.oldPrice > trip.price);
}

/** The trip-wide facts the dates imply: featured dates, the sale badge and the struck "from" price. */
function summarise(trip: Json, departures: unknown[], now: Date): Json {
  const today = departureDateKey(now);
  const rows = departures.filter(isObject);
  const ahead = rows.filter((departure) => bookableAhead(departure, today));
  const featuredDates = [...new Set(ahead.filter((departure) => departure.isFeatured === true)
    .map((departure) => departureDateKey(departure.startDate as string)))].sort();
  const percents = hasOwnSale(trip) ? [] : ahead.map((departure) => departure.salePercent).filter(positive);
  const dealt = departures.some((departure, index) => departure !== (trip.departures as unknown[])[index]);
  // Nothing to say: the very same object, as before deals existed.
  if (!dealt && !featuredDates.length && !percents.length && !("featuredDates" in trip) && trip.saleFromDates !== true) return trip;

  const out: Json = { ...trip, departures };
  if (featuredDates.length) {
    out.isFeatured = true;
    out.featuredDates = featuredDates;
  } else {
    delete out.featuredDates;
  }
  if (!percents.length) {
    // Run again on fares that no longer carry a sale (a brand's lowered fares): no badge left.
    if (trip.saleFromDates === true) {
      out.discount = null;
      out.oldPrice = null;
      delete out.saleFromDates;
    }
    return out;
  }
  out.discount = Math.max(...percents);
  out.saleFromDates = true;

  // The card's "-с эхлэн" (lib/departures startingPrice), with and without the date sales.
  const at = now.getTime();
  const shown = startingPrice(out as unknown as Trip, at);
  const regular = startingPrice({
    ...out,
    departures: rows.map((departure) => typeof departure.originalPrice === "number" ? { ...departure, price: departure.originalPrice } : departure),
  } as unknown as Trip, at);
  const fromSaleDate = rows.some((departure) => typeof departure.originalPrice === "number" && departure.price === shown);
  if (fromSaleDate && positive(regular) && shown < regular) out.oldPrice = regular;
  // A struck price left by an earlier run that no longer holds is never shown.
  else if (trip.saleFromDates === true && positive(out.oldPrice) && out.oldPrice > shown) out.oldPrice = null;
  return out;
}

export type DateDealInput = { salePrice?: number | null; saleChildPrice?: number | null; isFeatured?: boolean };

/** A typed sale fare: a positive amount, or null for "no sale" (blank, 0, junk). */
function typedSale(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/**
 * A date's deal fields as a trip save names them (server/tripInput normalizeDepartures).
 * Only the fields the payload carries: one it leaves out keeps what is stored (a save from
 * an older editor, or a sale the chatbot's assistant set), and null clears a sale.
 */
export function dateDealInput(departure: Record<string, unknown> | null | undefined): DateDealInput {
  const out: DateDealInput = {};
  if (!departure) return out;
  if ("salePrice" in departure) out.salePrice = typedSale(departure.salePrice);
  if ("saleChildPrice" in departure) out.saleChildPrice = typedSale(departure.saleChildPrice);
  if (typeof departure.isFeatured === "boolean") out.isFeatured = departure.isFeatured;
  return out;
}

/**
 * The trip with its date deals applied (see the file comment). Takes any shape that
 * has `departures` — a full trip, a card summary, or `{ price, departures }` — and
 * leaves anything else untouched.
 */
export function applyDateDeals<T>(trip: T, now: Date = new Date()): T {
  if (!isObject(trip) || !Array.isArray(trip.departures)) return trip;
  const departures = trip.departures.map((departure) => dealDeparture(departure, trip));
  return summarise(trip, departures, now) as T;
}
