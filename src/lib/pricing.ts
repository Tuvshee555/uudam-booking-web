/**
 * Trip pricing math, shared by the storefront, the admin panel and the API.
 *
 * Both sides MUST use these functions: the server recomputes every total from
 * the database at booking time, and if the client used different rules the
 * customer would see one number and be charged another.
 */

export type PassengerCounts = {
  adults: number;
  children: number;
  infants: number;
};

/** A trip always has a base fare. */
export type PriceSource = {
  price: number;
  childPrice?: number | null;
  infantPrice?: number | null;
};

/**
 * A departure's fares are all optional overrides — `null` means "inherit from
 * the trip", which is why this can't just reuse PriceSource.
 */
export type DeparturePriceSource = {
  price?: number | null;
  childPrice?: number | null;
  infantPrice?: number | null;
};

export type ResolvedPrices = {
  adult: number;
  /** null means "not published" — never render it as free. */
  child: number | null;
  infant: number | null;
};

/**
 * A departure may override any of the trip's fares. An override of `null`
 * means "inherit from the trip", not "free".
 */
export function resolvePrices(
  trip: PriceSource,
  departure?: DeparturePriceSource | null,
): ResolvedPrices {
  const pick = (dep: number | null | undefined, base: number | null | undefined) =>
    typeof dep === "number" ? dep : typeof base === "number" ? base : null;

  return {
    adult: departure?.price ?? trip.price,
    child: pick(departure?.childPrice, trip.childPrice),
    infant: pick(departure?.infantPrice, trip.infantPrice),
  };
}

/**
 * Fare actually charged for one passenger of a given type.
 *
 * When a child/infant fare isn't published the adult fare is charged rather
 * than zero. Quoting 0₮ for an unpublished infant fare would tell customers
 * babies travel free — a promise the agency never made.
 */
export function fareFor(
  type: "adult" | "child" | "infant",
  prices: ResolvedPrices,
): number {
  if (type === "adult") return prices.adult;
  if (type === "child") return prices.child ?? prices.adult;
  return prices.infant ?? prices.adult;
}

export function totalHeadcount(counts: PassengerCounts): number {
  return counts.adults + counts.children + counts.infants;
}

/** Line total for one trip/departure and its passenger mix. */
export function lineTotal(
  counts: PassengerCounts,
  prices: ResolvedPrices,
): number {
  const total =
    counts.adults * fareFor("adult", prices) +
    counts.children * fareFor("child", prices) +
    counts.infants * fareFor("infant", prices);

  return Math.round(total);
}

const MNT = new Intl.NumberFormat("mn-MN", { maximumFractionDigits: 0 });

/** Money for display, e.g. "2,450,000₮". */
export function formatMnt(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${MNT.format(Math.round(value))}₮`;
}

/** Imported chatbot rows use 0 when the source poster has no published base price. */
export function hasKnownTripPrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Public trip-card price label. A missing source price must never read as free. */
export function formatTripStartingPrice(value: number | null | undefined): string {
  return hasKnownTripPrice(value) ? formatMnt(value) : "Үнэ лавлах";
}

/**
 * Fare label for a passenger type. Unpublished child/infant fares read
 * "Тодруулна уу" (ask us) instead of a misleading 0₮.
 */
export function formatFare(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Тодруулна уу";
  if (value === 0) return "Үнэгүй";
  return formatMnt(value);
}
