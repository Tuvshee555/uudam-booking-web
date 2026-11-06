import type { Departure, Trip } from "@/types/trip";
import { departureDateKey } from "./departureDate.js";

export type PassengerOption = {
  /**
   * Unique within its row: label, age range and condition, plus "#2", "#3" for a
   * band that repeats all three with another fare. Table columns and booking
   * counters key by it, so two bands never share a column or a count.
   */
  key: string;
  /** What the band is called, with its age range and condition when the source label leaves them out. */
  label: string;
  ageRange: string;
  /** A non-age condition the chatbot states for the band ("1,2–1,4 м өндөр", "ор эзлэхгүй"); "" when none. */
  condition: string;
  /** The exact fare, or the low end of a range; null when no real fare is published. */
  price: number | null;
  /** Upper end when the source gives this band as a range; null for one exact fare. */
  priceMax: number | null;
  /** True only when the source itself marks the band free (a flag or "Үнэгүй"); price is then 0. */
  free: boolean;
};

export type DatePriceOption = {
  key: string;
  /** What a selector calls this row: the hotel, else the package, else the row's own label. */
  label: string;
  hotel: string;
  packageId: string;
  /** The package's display name from package_options (falls back to its id). */
  packageLabel: string;
  /** The package's description from package_options; empty when staff wrote none. */
  packageNote: string;
  /** The row's own name when it really is one — never the date the row was stamped with. */
  rowLabel: string;
  /** Staff's note on this price row ("Эрт захиалгын үнэ", "2 хүүхэд хүртэл"), as typed. */
  note: string;
  adult: number | null;
  adultMax: number | null;
  child: number | null;
  infant: number | null;
  singleSupplement: number | null;
  passengers: PassengerOption[];
  /** False for a variant that is sold out or paused on this date; only returned with `includeUnavailable`. */
  available: boolean;
};

export type PriceDimensionOption = {
  id: string;
  label: string;
  optionKey: string;
  /** The exact adult fare, or the low end of a ranged row. */
  adult: number | null;
  /** The high end of a ranged row; null for one exact fare. Print with formatAdultOption. */
  adultMax: number | null;
  delta: number | null;
  isCheapest: boolean;
};

const UNAVAILABLE_STATUSES = ["sold_out", "cancelled", "paused", "departed", "unavailable"];

/**
 * Prices the website may quote. A row priced in yuan (a land or settlement
 * price) is never a selling price, so its amounts are dropped and the row
 * reads "Үнэ лавлах" instead of showing a yuan figure with a ₮ sign.
 */
const SELLING_CURRENCIES = new Set(["", "MNT", "₮", "ТӨГРӨГ", "TUGRIK", "TUGRUG"]);

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function price(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * The lowest figure that is a real tugrug fare. 0 means "no published price"
 * on imported rows, and a sub-1,000₮ figure ("1₮") is typed to get past a
 * required field — the chatbot reads both the same way (tripOffers.ts money()).
 */
const MIN_REAL_FARE = 1000;

export function isRealFare(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= MIN_REAL_FARE;
}

function fare(value: unknown): number | null {
  const amount = price(value);
  return isRealFare(amount) ? amount : null;
}

const FREE_NOTE = /үнэгүй|\bfree\b/iu;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sellingCurrency(value: unknown): boolean {
  return typeof value !== "string" || SELLING_CURRENCIES.has(value.trim().toUpperCase());
}

function same(left: string, right: string): boolean {
  const fold = (value: string) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  return Boolean(left) && fold(left) === fold(right);
}

function packageOptionsOf(metadata: Record<string, unknown> | null | undefined): Record<string, unknown>[] {
  return Array.isArray(metadata?.package_options) ? metadata.package_options.map(object) : [];
}

function findPackageOption(packageOptions: Record<string, unknown>[], value: string) {
  return value ? packageOptions.find((item) => [text(item.id), text(item.label)].some((candidate) => same(candidate, value))) : undefined;
}

/**
 * Older partner rows pack the package into the hotel name
 * ("Example Bay · Хөтөлбөртэй") and leave package_id empty. Split it back into
 * its two choices, but only when the part after " · " really is one of this
 * trip's package options: a hotel whose own name contains " · " stays whole.
 * A row whose package_id disagrees with the suffix is left exactly as stored.
 */
export function splitPackedHotel(
  hotel: string,
  packageId: string,
  packageOptions: Record<string, unknown>[],
): { hotel: string; packageId: string } {
  const at = hotel.lastIndexOf(" · ");
  if (at <= 0) return { hotel, packageId };
  const left = hotel.slice(0, at).trim();
  const right = hotel.slice(at + 3).trim();
  const match = findPackageOption(packageOptions, right);
  if (!left || !match) return { hotel, packageId };
  const matchedId = text(match.id) || text(match.label);
  if (packageId && !same(packageId, matchedId) && !same(packageId, right)) return { hotel, packageId };
  return { hotel: left, packageId: packageId || matchedId };
}

/**
 * Words a written date list is made of: "2099 оны 11 сарын 11, 18", "11-р сарын 25-ны",
 * "11 сарын 11-ээс 25 хүртэл", "Nov 11". A label with any other word in it is a name.
 */
const DATE_WORDS = new Set([
  "сар", "сарын", "сард", "сараас", "он", "оны", "онд", "р", "ны", "ний", "нд", "д", "т",
  "ээс", "аас", "оос", "өөс", "хүртэл", "ба", "болон", "and",
  "jan", "january", "feb", "february", "mar", "march", "apr", "april", "may", "jun", "june",
  "jul", "july", "aug", "august", "sep", "sept", "september", "oct", "october", "nov", "november", "dec", "december",
]);

/**
 * True when a row's label is only the dates it was stamped with, never a name.
 * The poster mapper labels every row with its date text ("11 сарын 11, 11 сарын
 * 18"), while the website payload stamps the row with one ISO date, so the text
 * cannot be compared with the row's dates: it is recognised by its shape.
 */
export function isDateLabel(label: string, group: Record<string, unknown> = {}): boolean {
  const keys = [group.date_keys, group.dates, group.display_dates].flatMap((value) => Array.isArray(value) ? value : []);
  if (keys.some((key) => typeof key === "string" && same(key, label))) return true;
  if (!/\d/.test(label)) return false;
  const words = label.toLocaleLowerCase().replace(/\d+/g, " ").split(/[^\p{L}]+/u).filter(Boolean);
  return words.every((word) => DATE_WORDS.has(word));
}

/** "1,2–1,4 М" and "1.2-1.4 м" read as one text: case, spaces, dashes and decimal marks evened out. */
function foldCondition(value: string): string {
  return value.toLocaleLowerCase().replace(/(\d)\.(\d)/g, "$1,$2").replace(/\s*[-–—]\s*/g, "-").replace(/\s+/g, " ").trim();
}

/**
 * The band's visible label: the source label, plus its age range and its
 * condition when the label does not already say them. Two children's fares
 * that differ only by height ("Хүүхэд (1,2–1,4 м өндөр)") never read as one.
 */
function bandLabel(base: string, ageRange: string, condition: string): string {
  const label = ageRange && !base.includes(ageRange) ? `${base} ${ageRange}` : base;
  return condition && !foldCondition(label).includes(foldCondition(condition)) ? `${label} (${condition})` : label;
}

/**
 * One band per distinct fare, each with a key no other band of the row has. A
 * row that lists the same band twice (same label, age range, condition and
 * fare) gave twin counters that doubled the estimate and the enquiry's child
 * count; bands that share a name but not a fare both stay, keyed "#2".
 */
function uniqueBands(bands: Array<Omit<PassengerOption, "key">>): PassengerOption[] {
  const fares = new Set<string>();
  const keys = new Set<string>();
  return bands.flatMap((band) => {
    const name = [band.label, band.ageRange, band.condition].join("|");
    const fareKey = JSON.stringify([name, band.price, band.priceMax, band.free]);
    if (fares.has(fareKey)) return [];
    fares.add(fareKey);
    let key = name;
    for (let count = 2; keys.has(key); count += 1) key = `${name}#${count}`;
    keys.add(key);
    return [{ key, ...band }];
  });
}

type DateOptionsSettings = {
  /** Keep sold-out and paused variants (flagged `available: false`) — the price table shows them as full. */
  includeUnavailable?: boolean;
};

export function datePriceOptions(
  trip: Pick<Trip, "sourceMetadata">,
  departure: Pick<Departure, "startDate">,
  settings: DateOptionsSettings = {},
): DatePriceOption[] {
  const groups = trip.sourceMetadata?.price_groups;
  if (!Array.isArray(groups)) return [];
  const ageRules = object(trip.sourceMetadata?.age_rules);
  const packageOptions = packageOptionsOf(trip.sourceMetadata);
  const ageRule = (kind: "child" | "infant") =>
    typeof ageRules[kind] === "string" ? ageRules[kind].trim() : "";
  const day = departureDateKey(departure.startDate);
  const options = groups.flatMap((value): DatePriceOption[] => {
    const group = object(value);
    const status = object(group.availability);
    const available = !UNAVAILABLE_STATUSES.includes(text(status.status).toLowerCase()) && status.seatsLeft !== 0;
    if (!available && !settings.includeUnavailable) return [];
    const keys = Array.isArray(group.date_keys) ? group.date_keys : Array.isArray(group.dates) ? group.dates : [];
    if (keys.length > 0 && !keys.includes(day)) return [];
    const selling = sellingCurrency(group.currency);
    const amount = (input: unknown) => selling ? fare(input) : null;
    const range = object(group.adult_price_range);
    const passengers = Array.isArray(group.passenger_prices) ? group.passenger_prices : [];
    const { hotel, packageId } = splitPackedHotel(text(group.hotel), text(group.package_id), packageOptions);
    const packageOption = findPackageOption(packageOptions, packageId);
    const packageLabel = text(packageOption?.label) || packageId;
    const rawLabel = text(group.label);
    const rowLabel = rawLabel && !isDateLabel(rawLabel, group)
      && ![text(group.hotel), hotel, packageId, packageLabel].some((name) => same(name, rawLabel)) ? rawLabel : "";
    // Only what staff wrote for the package. A made-up description ("flights,
    // hotel and core services included") is a promise the data never made.
    const packageNote = text(packageOption?.note);
    const passengerOptions: Array<Omit<PassengerOption, "key">> = passengers.map((item) => {
      const passenger = object(item);
      const baseLabel = String(passenger.label || "Хүүхэд").trim();
      const ageRange = String(passenger.age_range || "").trim();
      const condition = text(passenger.condition);
      const passengerSelling = selling && sellingCurrency(passenger.currency);
      const bandRange = object(passenger.price_range);
      // 0 is free only when the band says so; otherwise it is an unpublished fare.
      const free = passengerSelling && price(passenger.price) === 0
        && (passenger.free === true || FREE_NOTE.test(text(passenger.note)));
      const exact = passengerSelling ? fare(passenger.price) : null;
      const low = passengerSelling ? fare(bandRange.min) : null;
      const high = passengerSelling ? fare(bandRange.max) : null;
      const ranged = exact == null && !free && low != null && high != null && high >= low;
      return {
        label: bandLabel(baseLabel, ageRange, condition),
        ageRange,
        condition,
        price: free ? 0 : exact ?? (ranged ? low : null),
        priceMax: ranged && high > low ? high : null,
        free,
      };
    });
    const hasPassenger = (pattern: RegExp) => passengerOptions.some((item) => pattern.test(item.label));
    // The chatbot's rule for a row's own child/infant figure: 0 is free only with a free
    // flag or an "Үнэгүй" note, and any other figure under 1,000₮ is not a fare at all.
    const scalarFree = (kind: "child" | "infant") => selling && price(group[`${kind}_price`]) === 0
      && (group.free === true || group[`${kind}_price_free`] === true || FREE_NOTE.test(text(group.note)));
    const childFree = scalarFree("child");
    const infantFree = scalarFree("infant");
    const childPrice = childFree ? 0 : amount(group.child_price);
    const infantPrice = infantFree ? 0 : amount(group.infant_price);
    // A row that names a child or infant figure keeps the band even when the figure is a
    // placeholder: the band reads "Үнэ лавлах" instead of vanishing or reading "Үнэгүй".
    const named = (kind: "child" | "infant") => selling && price(group[`${kind}_price`]) != null;
    if (named("child") && !hasPassenger(/хүүхэд|child/i)) {
      const ageRange = String(group.child_age || ageRule("child")).trim();
      passengerOptions.push({ label: ageRange ? `Хүүхэд ${ageRange}` : "Хүүхэд", ageRange, condition: "", price: childPrice, priceMax: null, free: childFree });
    }
    if (named("infant") && !hasPassenger(/нярай|infant/i)) {
      const ageRange = String(group.infant_age || ageRule("infant")).trim();
      passengerOptions.push({ label: ageRange ? `Нярай ${ageRange}` : "Нярай", ageRange, condition: "", price: infantPrice, priceMax: null, free: infantFree });
    }
    // A range alone (the website payload sends adult_price null for one) quotes its low end.
    const adult = amount(group.adult_price) ?? amount(range.min);
    const adultMax = amount(range.max);
    return [{
      key: `${hotel}|${packageId}|${rawLabel}`,
      label: hotel || packageLabel || rawLabel,
      hotel,
      packageId,
      packageLabel,
      packageNote,
      rowLabel,
      note: text(group.note),
      adult,
      adultMax: adult != null && adultMax != null && adultMax > adult ? adultMax : null,
      child: childPrice,
      infant: infantPrice,
      singleSupplement: amount(group.single_price),
      passengers: uniqueBands(passengerOptions),
      available,
    }];
  });
  // Two rows can share hotel, package and label; the key must still pick one.
  const seen = new Map<string, number>();
  return options.map((option) => {
    const count = seen.get(option.key) ?? 0;
    seen.set(option.key, count + 1);
    return count ? { ...option, key: `${option.key}#${count + 1}` } : option;
  });
}

/**
 * Every hotel label this trip is priced with, across all dates, in the order
 * the rows first name it — after a packed "Hotel · Package" is split apart.
 * A combined stay ("A+B") stays one label here; the hotel cards split it.
 */
export function pricedHotelLabels(trip: Pick<Trip, "sourceMetadata">): string[] {
  return pricedHotelOptions(trip).map((option) => option.label);
}

/** A hotel option the trip is priced with, and the hotel profiles the chatbot linked it to. */
export type PricedHotelOption = { label: string; profileIds: string[] };

function profileIdsOf(group: Record<string, unknown>): string[] {
  const listed = Array.isArray(group.hotel_profile_ids) ? group.hotel_profile_ids.map(text).filter(Boolean) : [];
  // hotel_id is the linked ids joined by "+" (set only when every hotel of the option linked).
  const ids = listed.length ? listed : text(group.hotel_id).split("+").map((id) => id.trim()).filter(Boolean);
  return [...new Set(ids)];
}

/**
 * Like pricedHotelLabels, with the profile ids the chatbot wrote on the rows
 * (`hotel_profile_ids`, else `hotel_id`), so a hotel card follows the link the
 * chatbot made instead of guessing again from the name.
 */
export function pricedHotelOptions(trip: Pick<Trip, "sourceMetadata">): PricedHotelOption[] {
  const groups = trip.sourceMetadata?.price_groups;
  if (!Array.isArray(groups)) return [];
  const packageOptions = packageOptionsOf(trip.sourceMetadata);
  const options: PricedHotelOption[] = [];
  for (const value of groups) {
    const group = object(value);
    const { hotel } = splitPackedHotel(text(group.hotel), text(group.package_id), packageOptions);
    if (!hotel) continue;
    const ids = profileIdsOf(group);
    const existing = options.find((option) => same(option.label, hotel));
    if (!existing) options.push({ label: hotel, profileIds: ids });
    else if (!existing.profileIds.length && ids.length) existing.profileIds = ids;
  }
  return options;
}

export function hasVariablePricing(trip: Pick<Trip, "sourceMetadata">): boolean {
  const groups = trip.sourceMetadata?.price_groups;
  return Array.isArray(groups) && groups.some((value) => {
    const group = object(value);
    const passengers = Array.isArray(group.passenger_prices) ? group.passenger_prices : [];
    return Boolean(group.hotel || group.package_id || group.adult_price_range || passengers.length > 0);
  });
}

const amountText = (value: number) => `${new Intl.NumberFormat("en-US").format(value)}₮`;

/** The adult fare: exact, a range, or "ask" — a 0₮ or 1₮ placeholder is never printed. */
export function formatAdultOption(option: Pick<DatePriceOption, "adult" | "adultMax">): string {
  if (!isRealFare(option.adult)) return "Үнэ лавлах";
  return isRealFare(option.adultMax) && option.adultMax > option.adult
    ? `${amountText(option.adult)}–${amountText(option.adultMax)}`
    : amountText(option.adult);
}

/** One passenger band's fare: exact, a range, free (only when marked so), or "ask" — never a guessed 0₮. */
export function formatPassengerOption(option: Pick<PassengerOption, "price" | "priceMax"> & { free?: boolean }): string {
  if (option.free === true) return "Үнэгүй";
  if (!isRealFare(option.price)) return "Үнэ лавлах";
  return isRealFare(option.priceMax) && option.priceMax > option.price
    ? `${amountText(option.price)}–${amountText(option.priceMax)}`
    : amountText(option.price);
}

export type QuoteTier = { count: number; price: number | null; priceMax: number | null };

/**
 * The booking panel's estimate for adults plus counted child/infant bands. A
 * band priced as a range adds its low end to `min` and its high end to `max`,
 * so the estimate spans the whole range instead of quoting only its floor. No
 * real adult fare, or a counted band with no fare, means no estimate at all.
 */
export function quoteRange(
  adults: number,
  adult: { low: number | null; high: number | null },
  tiers: QuoteTier[],
): { min: number; max: number } | null {
  if (!isRealFare(adult.low)) return null;
  if (tiers.some((tier) => tier.count > 0 && tier.price == null)) return null;
  const high = isRealFare(adult.high) && adult.high > adult.low ? adult.high : adult.low;
  const sum = (pick: (tier: QuoteTier) => number) => tiers.reduce((total, tier) => total + tier.count * pick(tier), 0);
  return {
    min: adults * adult.low + sum((tier) => tier.price ?? 0),
    max: adults * high + sum((tier) => tier.priceMax ?? tier.price ?? 0),
  };
}

/**
 * Build one independent selector (package or hotel) from the flattened fare
 * rows stored in price_groups. The opposite dimension is kept fixed so
 * changing the package keeps the hotel, and changing the hotel keeps the
 * package.
 */
export function priceDimensionOptions(
  options: DatePriceOption[],
  dimension: "package" | "hotel",
  selected: DatePriceOption | null,
): PriceDimensionOption[] {
  const idOf = (option: DatePriceOption) => dimension === "package" ? option.packageId : option.hotel;
  const oppositeOf = (option: DatePriceOption) => dimension === "package" ? option.hotel : option.packageId;
  const selectedOpposite = selected ? oppositeOf(selected) : "";
  const matching = options.filter((option) => idOf(option) && (!selectedOpposite || oppositeOf(option) === selectedOpposite));
  const unique = new Map<string, DatePriceOption>();
  for (const option of matching) {
    const id = idOf(option);
    const previous = unique.get(id);
    if (!previous || (option.adult ?? Number.POSITIVE_INFINITY) < (previous.adult ?? Number.POSITIVE_INFINITY)) {
      unique.set(id, option);
    }
  }
  const values = [...unique.values()];
  const cheapest = values.reduce<number | null>((minimum, option) => {
    if (option.adult == null) return minimum;
    return minimum == null ? option.adult : Math.min(minimum, option.adult);
  }, null);
  const result = values.map((option) => {
    const id = idOf(option);
    const delta = cheapest == null || option.adult == null ? null : option.adult - cheapest;
    return {
      id,
      label: dimension === "package" ? option.packageLabel || id : id,
      optionKey: option.key,
      adult: option.adult,
      adultMax: option.adultMax,
      delta,
      isCheapest: delta === 0,
    };
  });
  if (dimension === "package") {
    const rank = (label: string) => /хөтөлбөртэй/i.test(label) && !/гүй/i.test(label) ? 0 : /хөтөлбөргүй/i.test(label) ? 1 : 2;
    return result.sort((a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label, "mn"));
  }
  return result.sort((a, b) => (a.adult ?? Number.POSITIVE_INFINITY) - (b.adult ?? Number.POSITIVE_INFINITY));
}

export function formatPriceDelta(option: PriceDimensionOption): string {
  if (option.isCheapest) return "Хамгийн хямд";
  if (option.delta == null) return "Үнэ лавлах";
  return `+${amountText(option.delta)}`;
}
