/**
 * A secondary brand's prices, worked out from the shared catalogue at read time.
 *
 * Rule (the same one the chatbot applies, so the website and Messenger quote one figure): every
 * ADULT and CHILD fare of MIN_DISCOUNTED_FARE or more is `discount` tögrög lower. Infant fares,
 * single-room supplements, extra fees, deposits and the struck-through old price stay as they
 * are — except a date sale's regular fare and an old price worked out from date sales
 * (lib/dateDeals.ts), which are regular fares and are lowered like one. Text that repeats a fare
 * ("Хүүхэд (2-11 нас) - 1,234,000₮") gets the same new figure, but only for amounts that ARE one of that trip's adult/child fares, so a fee or a supplement written
 * in the same sentence is never touched.
 *
 * Pure and copy-on-write: the input (often a cached object shared by a page and its metadata)
 * is never mutated, so a value can never be discounted twice. It is only ever applied to what
 * the public sees — never to an admin read, and never to anything written back to the database.
 * No imports on purpose: the tests load this file straight under Node.
 */

export const MIN_DISCOUNTED_FARE = 200_000;

type Json = Record<string, unknown>;

export type BrandPricingOptions = {
  /** Tögrög off every adult/child fare; 0 leaves prices alone. */
  discount: number;
  /** Rewrites the primary brand's name in copy (brand.ts renameBrandIn); identity when absent. */
  rename?: (text: string) => string;
  /** Rewrites the primary brand's own links (poster PDFs, site pages) to this brand's. */
  rewriteUrl?: (url: string) => string;
};

function isObject(value: unknown): value is Json {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFare(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= MIN_DISCOUNTED_FARE;
}

/** One fare with the discount applied (anything that is not an eligible fare comes back as it was). */
export function discountFare<T>(value: T, discount: number): T {
  return (discount > 0 && isFare(value) ? value - discount : value) as T;
}

const SELLING_CURRENCIES = new Set(["", "MNT", "₮", "ТӨГРӨГ", "TUGRIK", "TUGRUG"]);

/** A row priced in yuan etc. is a land/settlement price, never a selling fare: left alone. */
function sellingCurrency(value: unknown): boolean {
  return typeof value !== "string" || SELLING_CURRENCIES.has(value.trim().toUpperCase());
}

const INFANT_WORD = /нярай|infant|\bbaby\b|хөхүүл/iu;

/**
 * True for a band or rule that can only be a baby: an infant word, an age span starting at 0 and
 * ending at 3 years or less ("0-2 нас"), an upper bound of 3 or less ("2 хүртэл", "2-оос доош",
 * "under 2"), months ("18 сар"), or birth years all within the last 3 years. "Хүүхэд" alone is a
 * child: the age decides, so "0-2 нас хүүхэд" is an infant and "2-11 нас хүүхэд" is not.
 */
export function isInfantShaped(...parts: unknown[]): boolean {
  const text = parts.filter((part): part is string => typeof part === "string").join(" ").toLowerCase();
  if (!text.trim()) return false;
  if (INFANT_WORD.test(text)) return true;
  // "18 сартай", "24 сар хүртэл" — not "10 сарын 8", which is a date.
  const months = text.match(/(\d{1,2})\s*(?:сар(?!ын)|month)/u);
  if (months && Number(months[1]) <= 36 && !/нас|жил|year/u.test(text)) return true;
  // Birth years only with "төрсөн"/"born": "2099 оны үнэ" is a price year, not an age.
  const years = [...text.matchAll(/(?<!\d)(19\d{2}|20\d{2})(?!\d)/gu)].map((match) => Number(match[1]));
  if (years.length && /төрс|born/u.test(text)) {
    const thisYear = new Date().getFullYear();
    return years.every((year) => thisYear - year <= 3);
  }
  const span = text.match(/(\d{1,2}(?:[.,]\d)?)\s*[-–—~]\s*(\d{1,2}(?:[.,]\d)?)/u);
  if (span) {
    const low = Number(span[1].replace(",", "."));
    const high = Number(span[2].replace(",", "."));
    return low === 0 && high <= 3;
  }
  const upTo = text.match(/(\d{1,2})\s*(?:хүртэл|-?\s*(?:оос|ээс|аас|өөс)\s*доош|\s*доош)|(?:under|below|<)\s*(\d{1,2})/u);
  if (upTo) return Number(upTo[1] ?? upTo[2]) <= 3;
  return false;
}

type FareSets = { adultChild: Set<number>; infant: Set<number> };

function add(set: Set<number>, value: unknown) {
  if (isFare(value)) set.add(value);
}

function addRange(set: Set<number>, range: unknown) {
  if (isObject(range)) {
    add(set, range.min);
    add(set, range.max);
  }
}

function collectGroup(group: unknown, sets: FareSets) {
  if (!isObject(group) || !sellingCurrency(group.currency)) return;
  add(sets.adultChild, group.adult_price);
  add(sets.adultChild, group.child_price);
  addRange(sets.adultChild, group.adult_price_range);
  addRange(sets.adultChild, group.child_price_range);
  add(sets.infant, group.infant_price);
  for (const band of Array.isArray(group.passenger_prices) ? group.passenger_prices : []) {
    if (!isObject(band) || !sellingCurrency(band.currency)) continue;
    const target = isInfantShaped(band.label, band.age_range) ? sets.infant : sets.adultChild;
    add(target, band.price);
    addRange(target, band.price_range);
  }
}

/** Every adult/child fare and every infant fare this trip publishes, wherever it is stored. */
export function collectFares(trip: unknown): FareSets {
  const sets: FareSets = { adultChild: new Set(), infant: new Set() };
  if (!isObject(trip)) return sets;
  add(sets.adultChild, trip.price);
  add(sets.adultChild, trip.childPrice);
  add(sets.infant, trip.infantPrice);
  for (const departure of Array.isArray(trip.departures) ? trip.departures : []) {
    if (!isObject(departure)) continue;
    add(sets.adultChild, departure.price);
    add(sets.adultChild, departure.childPrice);
    // A date's sale and, once applied (lib/dateDeals.ts), its regular fare moved aside.
    add(sets.adultChild, departure.salePrice);
    add(sets.adultChild, departure.saleChildPrice);
    add(sets.adultChild, departure.originalPrice);
    add(sets.adultChild, departure.originalChildPrice);
    add(sets.infant, departure.infantPrice);
  }
  const meta = isObject(trip.sourceMetadata) ? trip.sourceMetadata : null;
  if (meta) {
    for (const key of ["price_groups", "departure_date_groups"]) {
      for (const group of Array.isArray(meta[key]) ? meta[key] as unknown[] : []) collectGroup(group, sets);
    }
    for (const rule of Array.isArray(meta.child_rules) ? meta.child_rules : []) {
      if (!isObject(rule) || !sellingCurrency(rule.currency)) continue;
      add(isInfantShaped(rule.label, rule.age_range) ? sets.infant : sets.adultChild, rule.price);
    }
    for (const rule of Array.isArray(meta.infant_prices) ? meta.infant_prices : []) {
      if (isObject(rule)) add(sets.infant, rule.price);
    }
    if (isObject(meta.website_details)) {
      add(sets.adultChild, meta.website_details.price);
      add(sets.adultChild, meta.website_details.childPrice);
      add(sets.infant, meta.website_details.infantPrice);
    }
    const archive = isObject(meta.connectedSource) && isObject(meta.connectedSource.poster) ? meta.connectedSource.poster.public_archive : null;
    if (isObject(archive)) {
      add(sets.adultChild, archive.adult_price);
      add(sets.adultChild, archive.child_price_min);
      add(sets.adultChild, archive.child_price_max);
    }
  }
  return sets;
}

/**
 * original → discounted, for the amounts that are certainly adult/child fares: an amount that is
 * also one of the trip's infant fares is ambiguous in free text and is left as written.
 */
export function fareMap(trip: unknown, discount: number): Map<number, number> {
  const map = new Map<number, number>();
  if (discount <= 0) return map;
  const { adultChild, infant } = collectFares(trip);
  for (const amount of adultChild) if (!infant.has(amount)) map.set(amount, amount - discount);
  return map;
}

/*
 * A money figure in running text: "1,234,000", "1 234 000" (also no-break spaces), "1.234.000",
 * "1'234'000", a bare "1234000", or millions in words ("1.23 сая", "1,5 сая"). Groups must use one
 * separator throughout, so a date ("2099.10.08") or a phone number ("9911 2233") never reads as one.
 */
const MONEY = /(?<![\d.,'])(\d{1,3})(?:[.,](\d{1,3}))?\s*(сая)(?![\p{L}])|(?<![\d.,'\u00A0\u202F])(\d{1,3})([,. \u00A0\u202F'])(\d{3})((?:\5\d{3})*)(?![\d])(?![.,]\d)|(?<![\d.,'])(\d{6,9})(?![\d])(?![.,]\d)/gu;

function groupDigits(value: number, separator: string): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

function millions(value: number, decimalMark: string): string {
  const text = (value / 1_000_000).toFixed(3).replace(/\.?0+$/, "");
  return decimalMark === "," ? text.replace(".", ",") : text;
}

/** The text with every exact fare from `fares` replaced by its discounted figure, formatting kept. */
export function discountFaresInText(text: string, fares: Map<number, number>): string {
  if (!text || !fares.size) return text;
  return text.replace(MONEY, (match, mWhole, mFrac, mWord, gHead, gSep, gFirst, gRest, plain) => {
    if (mWord) {
      const fraction = mFrac ? Number(`0.${mFrac}`) : 0;
      const amount = Math.round((Number(mWhole) + fraction) * 1_000_000);
      const next = fares.get(amount);
      if (next === undefined) return match;
      const decimalMark = match.includes(",") ? "," : ".";
      return match.replace(/^\d{1,3}(?:[.,]\d{1,3})?/, millions(next, decimalMark));
    }
    if (gHead) {
      const amount = Number(`${gHead}${gFirst}${(gRest as string).split(gSep).join("")}`);
      const next = fares.get(amount);
      return next === undefined ? match : groupDigits(next, gSep);
    }
    const amount = Number(plain);
    const next = fares.get(amount);
    return next === undefined ? match : String(next);
  });
}

/* Keys whose strings are identifiers, addresses or dates — never copy with a price or a name in it. */
const IDENTIFIER_KEY = /^(?:id|slug|sourceTripId|tripId|departureId|categoryId|date_keys|dates|display_dates|ymd|image|images|extraImages|video|videos|url|href|src)$|(?:Id|_id|_ids|Ids|Url|_url|At|_at)$/;
/* Amounts stored here are fees, supplements or infant fares — never discounted, text left as is. */
const UNTOUCHED_METADATA_KEYS = new Set(["infant_prices", "infant_fare_label", "extra_fees", "single_room_supplements", "foreign_currency_fees"]);
const URLISH = /^(?:https?:)?\/\//i;

type Context = { discount: number; fares: Map<number, number>; rename: (text: string) => string; rewriteUrl: (url: string) => string };

function transformString(value: string, context: Context): string {
  if (URLISH.test(value.trim())) return context.rewriteUrl(value);
  return context.rename(discountFaresInText(value, context.fares));
}

/** Free-form data: strings get fare text + names rewritten; numbers only when they equal a known fare. */
function transformLoose(value: unknown, context: Context, key = ""): unknown {
  if (typeof value === "string") return IDENTIFIER_KEY.test(key) ? (URLISH.test(value.trim()) ? context.rewriteUrl(value) : value) : transformString(value, context);
  if (typeof value === "number") return context.fares.get(value) ?? value;
  if (Array.isArray(value)) return value.map((entry) => transformLoose(entry, context, key));
  if (isObject(value)) {
    const out: Json = {};
    for (const [childKey, child] of Object.entries(value)) out[childKey] = transformLoose(child, context, childKey);
    return out;
  }
  return value;
}

function transformRange(range: unknown, context: Context): unknown {
  if (!isObject(range)) return range;
  return { ...range, min: discountFare(range.min, context.discount), max: discountFare(range.max, context.discount) };
}

/** Strings of a structured row (notes, labels): fare text and names, nothing else. */
function transformTexts(row: Json, context: Context, skip: Set<string>): Json {
  const out: Json = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = skip.has(key) ? value : typeof value === "string" && !IDENTIFIER_KEY.test(key) ? transformString(value, context) : value;
  }
  return out;
}

const GROUP_ROLE_KEYS = new Set(["adult_price", "child_price", "adult_price_range", "child_price_range", "infant_price", "single_price", "passenger_prices"]);

function transformGroup(group: unknown, context: Context): unknown {
  if (!isObject(group) || !sellingCurrency(group.currency)) return group;
  const out = transformTexts(group, context, GROUP_ROLE_KEYS);
  out.adult_price = discountFare(group.adult_price, context.discount);
  out.child_price = discountFare(group.child_price, context.discount);
  if ("adult_price_range" in group) out.adult_price_range = transformRange(group.adult_price_range, context);
  if ("child_price_range" in group) out.child_price_range = transformRange(group.child_price_range, context);
  if (Array.isArray(group.passenger_prices)) {
    out.passenger_prices = group.passenger_prices.map((band) => {
      if (!isObject(band) || !sellingCurrency(band.currency) || isInfantShaped(band.label, band.age_range)) return band;
      const next = transformTexts(band, context, new Set(["price", "price_range"]));
      next.price = discountFare(band.price, context.discount);
      if ("price_range" in band) next.price_range = transformRange(band.price_range, context);
      return next;
    });
  }
  return out;
}

function transformChildRule(rule: unknown, context: Context): unknown {
  if (!isObject(rule) || !sellingCurrency(rule.currency) || isInfantShaped(rule.label, rule.age_range)) return rule;
  const out = transformTexts(rule, context, new Set(["price"]));
  out.price = discountFare(rule.price, context.discount);
  return out;
}

function transformMetadata(meta: unknown, context: Context): unknown {
  if (!isObject(meta)) return meta;
  const out: Json = {};
  for (const [key, value] of Object.entries(meta)) {
    if (UNTOUCHED_METADATA_KEYS.has(key)) out[key] = value;
    else if ((key === "price_groups" || key === "departure_date_groups") && Array.isArray(value)) out[key] = value.map((group) => transformGroup(group, context));
    else if (key === "child_rules" && Array.isArray(value)) out[key] = value.map((rule) => transformChildRule(rule, context));
    else out[key] = transformLoose(value, context, key);
  }
  return out;
}

const DEPARTURE_FARE_KEYS = new Set(["price", "childPrice", "infantPrice", "salePrice", "saleChildPrice", "originalPrice", "originalChildPrice", "salePercent"]);

/**
 * A date on sale (lib/dateDeals.ts) shows its regular fare struck through: that fare is lowered
 * by the same rule as the sale fare, and the percent is worked out again from the two lowered
 * figures. A sale that is no longer below the lowered regular fare (only possible under
 * MIN_DISCOUNTED_FARE) is dropped and the date sells at its lowered regular fare.
 */
function rebaseSale(out: Json, priceKey: "price" | "childPrice", originalKey: "originalPrice" | "originalChildPrice", percentKey?: "salePercent") {
  const regular = out[originalKey];
  if (typeof regular !== "number") return;
  const sale = out[priceKey];
  if (typeof sale === "number" && sale < regular) {
    if (percentKey) out[percentKey] = Math.round(((regular - sale) / regular) * 100);
    return;
  }
  out[priceKey] = regular;
  delete out[originalKey];
  if (percentKey) delete out[percentKey];
}

function transformDeparture(departure: unknown, context: Context): unknown {
  if (!isObject(departure)) return departure;
  const out = transformTexts(departure, context, DEPARTURE_FARE_KEYS);
  for (const key of ["price", "childPrice", "salePrice", "saleChildPrice", "originalPrice", "originalChildPrice"]) {
    if (key in departure) out[key] = discountFare(departure[key], context.discount);
  }
  rebaseSale(out, "price", "originalPrice", "salePercent");
  rebaseSale(out, "childPrice", "originalChildPrice");
  return out;
}

/* Top-level trip fields that are not prices to discount or text to rewrite. */
const TRIP_UNTOUCHED = new Set(["infantPrice", "oldPrice", "discount", "singleSupplement", "testimonials", "category", "categories", "tags", "currency", "featuredDates", "saleFromDates"]);

/**
 * The trip as a secondary brand shows it. Returns the input itself when there is nothing to do
 * (discount 0 and no renaming), so the primary brand's objects pass through untouched.
 */
export function brandTrip<T>(trip: T, options: BrandPricingOptions): T {
  if (!isObject(trip)) return trip;
  const discount = options.discount > 0 ? options.discount : 0;
  if (!discount && !options.rename && !options.rewriteUrl) return trip;
  const context: Context = {
    discount,
    fares: fareMap(trip, discount),
    rename: options.rename ?? ((text) => text),
    rewriteUrl: options.rewriteUrl ?? ((url) => url),
  };
  const out: Json = {};
  for (const [key, value] of Object.entries(trip)) {
    if (key === "price" || key === "childPrice") out[key] = discountFare(value, discount);
    // An old "from" price worked out from date sales is a regular fare: lowered like one.
    else if (key === "oldPrice" && trip.saleFromDates === true) out[key] = discountFare(value, discount);
    else if (key === "departures" && Array.isArray(value)) out[key] = value.map((departure) => transformDeparture(departure, context));
    else if (key === "sourceMetadata") out[key] = transformMetadata(value, context);
    else if (TRIP_UNTOUCHED.has(key)) out[key] = value;
    else out[key] = transformLoose(value, context, key);
  }
  return out as T;
}
