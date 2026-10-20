import { departureDateKey } from "./departureDate.js";
import type { Departure } from "@/types/trip";

/**
 * Automatic checks for the mistakes that reached customers before anyone
 * noticed: phantom next-year dates, a flat price where hotel fares belong,
 * child fares above adult fares, prices that drifted from the partner's
 * table, and edits that never reached the chatbot. Each check is named after
 * the incident it would have caught.
 */

export type HealthSeverity = "error" | "warning";
export type HealthIssue = {
  tripId: string;
  slug: string;
  title: string;
  severity: HealthSeverity;
  code: string;
  message: string;
};

type HealthDeparture = Pick<Departure, "startDate" | "status" | "price" | "childPrice" | "seatsLeft">;
export type HealthTrip = {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
  price: number;
  image: string;
  sourceMetadata: unknown;
  departures: HealthDeparture[];
};

type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const money = (value: number) => `${new Intl.NumberFormat("en-US").format(value)}₮`;
const WEEKDAYS: Array<[RegExp, number, string]> = [
  [/даваа/i, 1, "Даваа"], [/мягмар/i, 2, "Мягмар"], [/лхагва/i, 3, "Лхагва"], [/пүрэв/i, 4, "Пүрэв"],
  // \b is ASCII-only in JS, so a Cyrillic word boundary is spelled out.
  [/баасан/i, 5, "Баасан"], [/бямба/i, 6, "Бямба"], [/(?:^|[^а-яёөү])ням(?:[^а-яёөү]|$)/i, 0, "Ням"],
];

/** Same rule as availability().selectable in departures.ts (kept import-free so node tests can load this file). */
function selectable(departure: HealthDeparture): boolean {
  if (["CANCELLED", "DEPARTED", "SOLD_OUT", "PAUSED"].includes(departure.status)) return false;
  return !(departure.seatsLeft !== null && departure.seatsLeft <= 0);
}

function fareRows(trip: HealthTrip): Row[] {
  const groups = record(trip.sourceMetadata).price_groups;
  return Array.isArray(groups) ? groups.map(record) : [];
}

function rowDates(row: Row): string[] {
  const keys = Array.isArray(row.date_keys) ? row.date_keys : Array.isArray(row.dates) ? row.dates : [];
  return keys.filter((key): key is string => typeof key === "string" && ISO.test(key));
}

/** Pure checks on one trip's stored data. `today` is the Ulaanbaatar calendar date. */
export function checkTrip(trip: HealthTrip, today: string, now = Date.now()): HealthIssue[] {
  if (!trip.isPublished) return [];
  const issues: HealthIssue[] = [];
  const add = (severity: HealthSeverity, code: string, message: string) =>
    issues.push({ tripId: trip.id, slug: trip.slug, title: trip.title, severity, code, message });

  const departures = trip.departures.map((departure) => ({ ...departure, day: departureDateKey(departure.startDate) }));
  const upcoming = departures.filter((departure) => departure.day >= today && departure.status !== "CANCELLED" && departure.status !== "DEPARTED");
  const bookable = upcoming.filter(selectable);

  if (!trip.image) add("error", "no_image", "Нүүр зураггүй.");
  if (!bookable.length) {
    add("warning", "no_bookable_date", upcoming.length
      ? "Захиалах боломжтой огноо алга (бүх огноо дүүрсэн/идэвхгүй)."
      : "Ирээдүйн огноо алга — нийтэд харагдаж байгаа ч захиалах өдөргүй.");
  }

  for (const departure of bookable) {
    const price = departure.price ?? (trip.price > 0 ? trip.price : null);
    if (price == null) add("error", "date_without_price", `${departure.day}: захиалга нээлттэй боловч үнэгүй.`);
    if (price != null && departure.childPrice != null && departure.childPrice > price) {
      add("error", "child_over_adult", `${departure.day}: хүүхдийн үнэ ${money(departure.childPrice)} том хүний ${money(price)}-с их.`);
    }
  }

  // Хайкоу, Турк, Шанхай (2026-10-15/16): an old roll-forward copied 2026
  // departures into 2027/2028 and they were sold as real dates.
  const firstYearByDay = new Map<string, string>();
  for (const departure of [...departures].sort((a, b) => a.day.localeCompare(b.day))) {
    if (!firstYearByDay.has(departure.day.slice(5))) firstYearByDay.set(departure.day.slice(5), departure.day);
  }
  const copies = bookable.filter((departure) => (firstYearByDay.get(departure.day.slice(5)) || departure.day) < departure.day);
  if (copies.length) {
    add("error", "year_copy_date", `Өмнөх оны огнооны хуулбар байж магадгүй: ${copies.map((d) => d.day).join(", ")}. Жинхэнэ огноо мөн эсэхийг шалгана уу.`);
  }
  const farLimit = new Date(now + 400 * 86_400_000).toISOString().slice(0, 10);
  const far = bookable.filter((departure) => departure.day > farLimit && !copies.includes(departure));
  if (far.length) add("warning", "far_future_date", `1 жилээс хол огноо зарагдаж байна: ${far.map((d) => d.day).join(", ")}.`);

  // "ХАЙНАН – САНЬЯА АЯЛАЛ-Лхагва" sold Wednesdays while its dates said otherwise.
  const weekday = WEEKDAYS.find(([pattern]) => pattern.test(trip.title));
  if (weekday) {
    const offDay = bookable.filter((departure) => new Date(`${departure.day}T00:00:00Z`).getUTCDay() !== weekday[1]);
    if (offDay.length) add("warning", "weekday_mismatch", `Нэрэнд "${weekday[2]}" гэсэн ч ${offDay.map((d) => d.day).join(", ")} өөр гарагт таарч байна.`);
  }

  // Санья (2026-10-15): hotel fares belonged to old dates, so the live dates
  // showed one flat price and no hotel choice.
  const rows = fareRows(trip);
  const choiceRows = rows.filter((row) => row.hotel || row.package_id);
  if (choiceRows.length) {
    const withChoices = new Set(choiceRows.flatMap(rowDates));
    const bare = bookable.filter((departure) => !withChoices.has(departure.day));
    if (bare.length && withChoices.size) {
      add("error", "date_without_options", `${bare.map((d) => d.day).join(", ")}: буудал/багцын сонголтгүй — бусад огноонд байгаа. Хуучин огнооны үнэ үлдсэн байж магадгүй.`);
    }
  }

  // A website edit that never reached the chatbot and poster.
  const pending = record(record(trip.sourceMetadata).websiteSyncPending);
  if (typeof pending.queuedAt === "string" && now - Date.parse(pending.queuedAt) > 15 * 60_000) {
    add("error", "sync_stuck", "Сайтын засвар chatbot/poster руу очоогүй байна (15 минутаас удсан). Аяллыг нээж дахин синк хийнэ үү.");
  }
  return issues;
}

/** Checks across the catalog (duplicates) plus every trip's own checks. */
export function checkCatalog(trips: HealthTrip[], today: string, now = Date.now()): HealthIssue[] {
  const issues = trips.flatMap((trip) => checkTrip(trip, today, now));
  const byTitle = new Map<string, HealthTrip[]>();
  for (const trip of trips.filter((t) => t.isPublished)) {
    const key = trip.title.trim().toLowerCase();
    byTitle.set(key, [...(byTitle.get(key) || []), trip]);
  }
  for (const same of byTitle.values()) {
    if (same.length < 2) continue;
    for (const trip of same) {
      issues.push({ tripId: trip.id, slug: trip.slug, title: trip.title, severity: "warning", code: "duplicate_title",
        message: `Ижил нэртэй ${same.length} нийтлэгдсэн аялал байна.` });
    }
  }
  return issues;
}

/** One partner price-table row, normalised (see partnerFares.ts). */
export type PartnerFare = {
  date: string;
  hotel: string;
  packageId: string;
  adult: number | null;
  child611: number | null;
  child25: number | null;
  infant: number | null;
  single: number | null;
};

/**
 * Санья (2026-10-18): GTC raised two child fares by 200,000₮ after we copied
 * their table, and staff found it by hand. Compares every upcoming partner
 * row with our fare row for the same date, hotel and package.
 */
export function comparePartnerFares(trip: HealthTrip, partner: string, fares: PartnerFare[], today: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const add = (severity: HealthSeverity, code: string, message: string) =>
    issues.push({ tripId: trip.id, slug: trip.slug, title: trip.title, severity, code, message });
  const rows = fareRows(trip);
  const ours = new Set(trip.departures.filter((d) => d.status !== "CANCELLED").map((d) => departureDateKey(d.startDate)));
  const theirsDates = new Set(fares.map((fare) => fare.date));
  const missing = [...theirsDates].filter((date) => date >= today && !ours.has(date)).sort();
  if (missing.length) add("warning", "partner_date_missing", `${partner}-д байгаа огноо манайд алга: ${missing.join(", ")}.`);

  const diffs: string[] = [];
  for (const fare of fares.filter((f) => f.date >= today)) {
    const row = rows.find((r) => rowDates(r).includes(fare.date) && String(r.hotel || "") === fare.hotel && String(r.package_id || "") === fare.packageId);
    if (!row) { diffs.push(`${fare.date} ${fare.hotel} ${fare.packageId}: манайд энэ мөр алга`); continue; }
    const passengers = Array.isArray(row.passenger_prices) ? row.passenger_prices.map(record) : [];
    const band = (range: string) => passengers.find((p) => String(p.age_range || "").startsWith(range))?.price;
    const pairs: Array<[string, number | null, unknown]> = [
      ["том хүн", fare.adult, row.adult_price],
      ["хүүхэд 6-11", fare.child611, band("6-11") ?? row.child_price],
      ["хүүхэд 2-5", fare.child25, band("2-5")],
      ["нярай", fare.infant, band("0-2") ?? row.infant_price],
      ["ганцаараа", fare.single, row.single_price],
    ];
    for (const [label, theirs, mine] of pairs) {
      if (theirs != null && theirs !== mine) {
        diffs.push(`${fare.date} ${fare.hotel} ${fare.packageId} ${label}: манайд ${typeof mine === "number" ? money(mine) : "байхгүй"}, ${partner}: ${money(theirs)}`);
      }
    }
  }
  if (diffs.length) {
    add("error", "partner_price_drift", `${partner}-ийн үнээс ${diffs.length} зөрүү: ${diffs.slice(0, 6).join("; ")}${diffs.length > 6 ? " …" : ""}`);
  }
  return issues;
}
