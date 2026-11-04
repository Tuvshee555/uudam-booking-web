import type { Departure, Trip } from "@/types/trip";
import { availability, formatDepartureDate, startingPrice, upcomingDepartures } from "./departures";
import { departureDateKey } from "./departureDate.js";
import { fold, tripDestinations } from "./destinations";
import { formatMnt, hasKnownTripPrice } from "./pricing";

/**
 * The on-site trip advisor's matching and facts, kept pure so the tests can
 * run it against fixtures. The facts it quotes (the "-с эхлэн" price and the
 * next open dates with their fares) are worked out by the same functions the
 * trip cards and the booking panel use (lib/departures), from the same rows,
 * so the advisor can never quote a price or a date the website does not show.
 *
 * Deliberately free of any hardcoded trip name, price or date: everything is
 * matched against whatever is in the database, so deleting or renaming a trip
 * can never break this. The only literals are language-level (month names,
 * "cheap", "when") which are properties of Mongolian, not of the catalog.
 */

export type SearchableDeparture = {
  id: string;
  startDate: Date | string;
  price: number | null;
  status: Departure["status"];
  seatsLeft: number | null;
};

export type SearchableTrip = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  price: number;
  image: string;
  country: string | null;
  city: string | null;
  destinations: string[];
  durationDays: number;
  departures: SearchableDeparture[];
  category: { categoryName: string } | null;
  categories: { categoryName: string }[];
};

export type NextDeparture = { date: string; label: string; price: number | null; seats: string };

/** What the advisor may say about a trip: the price the site shows, and the next open dates. */
export type TripOffer = { fromPrice: number | null; nextDepartures: NextDeparture[]; openCount: number };

function asDepartures(trip: SearchableTrip): Departure[] {
  return trip.departures.map((departure) => ({
    id: departure.id,
    tripId: trip.id,
    label: null,
    startDate: typeof departure.startDate === "string" ? departure.startDate : departure.startDate.toISOString(),
    endDate: null,
    seatsTotal: null,
    seatsLeft: departure.seatsLeft,
    price: departure.price,
    childPrice: null,
    infantPrice: null,
    status: departure.status,
  }));
}

/**
 * `preferMonth` (1–12) puts that month's dates first when the visitor asked
 * about a month, so "12 сард" is answered with December dates rather than the
 * three nearest ones.
 */
export function tripOffer(trip: SearchableTrip, now = Date.now(), limit = 3, preferMonth?: number | null): TripOffer {
  const shaped = { price: trip.price, departures: asDepartures(trip) } as Trip;
  const upcoming = upcomingDepartures(shaped, now).filter((departure) => availability(departure).selectable);
  const inMonth = (departure: Departure) => Number(departureDateKey(departure.startDate).slice(5, 7)) === preferMonth;
  const open = preferMonth ? [...upcoming.filter(inMonth), ...upcoming.filter((departure) => !inMonth(departure))] : upcoming;
  const from = startingPrice(shaped, now);
  return {
    fromPrice: hasKnownTripPrice(from) ? from : null,
    openCount: open.length,
    nextDepartures: open.slice(0, limit).map((departure) => ({
      date: departureDateKey(departure.startDate),
      label: formatDepartureDate(departure.startDate),
      price: hasKnownTripPrice(departure.price ?? trip.price) ? (departure.price ?? trip.price) : null,
      seats: availability(departure).label,
    })),
  };
}

const MONTHS: Record<string, number> = {
  "1-р сар": 1, "нэгдүгээр": 1, january: 1, "1 сар": 1,
  "2-р сар": 2, "хоёрдугаар": 2, february: 2, "2 сар": 2,
  "3-р сар": 3, "гуравдугаар": 3, march: 3, "3 сар": 3,
  "4-р сар": 4, "дөрөвдүгээр": 4, april: 4, "4 сар": 4,
  "5-р сар": 5, "тавдугаар": 5, may: 5, "5 сар": 5,
  "6-р сар": 6, "зургаадугаар": 6, june: 6, "6 сар": 6,
  "7-р сар": 7, "долдугаар": 7, july: 7, "7 сар": 7,
  "8-р сар": 8, "наймдугаар": 8, august: 8, "8 сар": 8,
  "9-р сар": 9, "есдүгээр": 9, september: 9, "9 сар": 9,
  "10-р сар": 10, "аравдугаар": 10, october: 10, "10 сар": 10,
  "11-р сар": 11, "арван нэгдүгээр": 11, november: 11, "11 сар": 11,
  "12-р сар": 12, "арван хоёрдугаар": 12, december: 12, "12 сар": 12,
};

/** Pull a budget ceiling out of phrases like "3 саяд багтах" or "2000000 хүртэл". */
function parseBudget(text: string): number | null {
  const million = text.match(/(\d+(?:[.,]\d+)?)\s*(сая|сая₮|сая төгрөг)/);
  if (million) {
    const value = Number.parseFloat(million[1].replace(",", "."));
    if (Number.isFinite(value)) return value * 1_000_000;
  }
  const thousand = text.match(/(\d+(?:[.,]\d+)?)\s*(мянга|мянган)/);
  if (thousand) {
    const value = Number.parseFloat(thousand[1].replace(",", "."));
    if (Number.isFinite(value)) return value * 1_000;
  }
  const plain = text.match(/(\d{6,9})\s*(₮|төгрөг)?/);
  if (plain) {
    const value = Number.parseInt(plain[1], 10);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

/** Longest name first: "арван хоёрдугаар" (12) must not be read as "хоёрдугаар" (2). */
const MONTH_NAMES = Object.entries(MONTHS).filter(([needle]) => !/\d/.test(needle)).sort((a, b) => b[0].length - a[0].length);

function parseMonth(text: string): number | null {
  // "12 сард", "12-р сарын": the whole number, so "12 сар" is never read as "2 сар".
  const numeric = text.match(/(?:^|[^\d])(\d{1,2})\s*(?:-р)?\s*сар/);
  if (numeric) {
    const month = Number(numeric[1]);
    if (month >= 1 && month <= 12) return month;
  }
  for (const [needle, month] of MONTH_NAMES) {
    if (text.includes(needle)) return month;
  }
  return null;
}

/** The month a question asks about ("12 сард", "арван хоёрдугаар сар"), if any. */
export function questionMonth(question: string): number | null {
  return parseMonth(question.toLowerCase());
}

/** Words that describe asking about a trip rather than naming one; matching them ranked every trip. */
const STOPWORDS = new Set(["аялал", "аяллын", "аяллаар", "аяллууд", "аялах", "аялмаар", "явах", "явмаар", "явъя", "явна", "байна", "байгаа", "байх",
  "хэзээ", "хэд", "үнэ", "үнэтэй", "үнийг", "хүртэл", "хоног", "хоногийн", "сард", "сар", "сарын", "өдөр", "гаралт", "огноо", "хүн", "trip", "tour", "price", "the", "and"]);

function parseDuration(text: string): number | null {
  const match = text.match(/(\d{1,2})\s*(хоног|өдөр|day|days)/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

/** Whether the question is about when a trip leaves. */
export function asksForDates(question: string): boolean {
  return /хэзээ|огноо|гаралт|хөдл|явах өдөр|хуваарь|\bwhen\b|\bdate/i.test(question);
}

/** Whether the question tries to book or pay — which only staff do. */
export function asksToBook(question: string): boolean {
  return /захиал|төл(бөр|ье|нө|өх)|суудал авах|бүртгүүл|book|pay|reserv/i.test(question);
}

/** Every searchable name of a trip: its own words plus the Mongolian and Latin names of where it goes. */
function searchTokens(trip: SearchableTrip): string[] {
  const own = fold([
    trip.title,
    trip.summary ?? "",
    trip.country ?? "",
    trip.city ?? "",
    trip.category?.categoryName ?? "",
    ...trip.categories.map((category) => category.categoryName),
    ...trip.destinations,
  ].join(" ")).split(" ");
  const places = tripDestinations(trip).flatMap((destination) => [destination.label, destination.country, ...destination.terms].map(fold));
  return [...new Set([...own, ...places.flatMap((place) => place.split(" ")), ...places])].filter(Boolean);
}

/** "хайнаны" matches "хайнан", "hainan" matches a Hainan trip, "пхукет" matches "Пукет" via its terms. */
function tokenMatches(token: string, word: string): boolean {
  if (token === word) return true;
  if (word.length >= 4 && token.length >= 4) return token.startsWith(word) || word.startsWith(token);
  return false;
}

export type ScoredTrip = { trip: SearchableTrip; score: number };

/**
 * Score trips against a free-text question. Returns only positive matches, so
 * "I have no idea what you mean" stays distinguishable from "here's something".
 */
export function searchTrips(question: string, trips: SearchableTrip[], now = Date.now()): ScoredTrip[] {
  const text = fold(question);
  if (!text) return [];

  const budget = parseBudget(question.toLowerCase());
  const month = parseMonth(question.toLowerCase());
  const duration = parseDuration(question.toLowerCase());
  const wantsCheap = /хямд|хямдхан|хамгийн бага|cheap/.test(text);

  const words = text.split(" ").filter((word) => word.length >= 3 && !STOPWORDS.has(word));

  const scored = trips.map((trip) => {
    let score = 0;
    const tokens = searchTokens(trip);
    const offer = tripOffer(trip, now);
    const price = offer.fromPrice ?? trip.price;

    for (const word of words) {
      if (tokens.some((token) => tokenMatches(token, word))) score += 3;
    }

    // A place the trip goes to, named in the question, is much stronger evidence than a stray word.
    const places = tripDestinations(trip).flatMap((destination) => destination.terms.map(fold));
    const place = places.some((term) => ` ${text} `.includes(` ${term}`));
    if (place) score += 8;

    if (budget && price <= budget) score += 4;
    if (budget && price > budget) score -= 6;

    // Only dates a visitor can still book count for "in December".
    if (month && trip.departures.some((dep) => {
      const key = departureDateKey(dep.startDate);
      return Number(key.slice(5, 7)) === month && new Date(dep.startDate).getTime() >= now && !["CANCELLED", "DEPARTED"].includes(dep.status);
    })) {
      score += 6;
    }

    if (duration && Math.abs(trip.durationDays - duration) <= 1) score += 4;

    return { trip, score, place };
  });

  // A named place is the question: "Хайнань 12 сард хямд" is about Hainan trips
  // in December, never about the cheapest December trip anywhere.
  const named = scored.filter((entry) => entry.place);
  const positive = (named.length ? named : scored).filter((entry) => entry.score > 0);

  if (wantsCheap) {
    // "cheapest" is a sort instruction, not a filter — fall back to the whole
    // catalog when nothing else in the question narrowed it down.
    const pool = positive.length ? positive : scored;
    // A trip without a bookable, priced date is not "cheap"; it goes last.
    const priceOf = (entry: ScoredTrip) => tripOffer(entry.trip, now).fromPrice ?? Number.POSITIVE_INFINITY;
    return [...pool].sort((a, b) => priceOf(a) - priceOf(b)).slice(0, 3).map(({ trip, score }) => ({ trip, score }));
  }

  return positive.sort((a, b) => b.score - a.score).slice(0, 3).map(({ trip, score }) => ({ trip, score }));
}

export const STAFF_CONFIRM_LINE = "Захиалга, төлбөрийг зөвхөн манай ажилтан утас эсвэл Messenger-ээр баталгаажуулна — би захиалга баталгаажуулдаггүй.";

/** One trip as a line of plain facts: price the site shows, next open dates with their fares. */
export function describeOffer(trip: SearchableTrip, offer: TripOffer): string {
  const price = offer.fromPrice !== null ? `${formatMnt(offer.fromPrice)}-с эхэлнэ` : "үнийг ажилтнаас лавлана";
  const dates = offer.nextDepartures.length
    ? `ойрын огноо: ${offer.nextDepartures.map((entry) => `${entry.label}${entry.price !== null ? ` (${formatMnt(entry.price)})` : ""}`).join(", ")}${offer.openCount > offer.nextDepartures.length ? ` +${offer.openCount - offer.nextDepartures.length} огноо` : ""}`
    : "одоогоор нээлттэй огноо алга — огноог ажилтнаас лавлана";
  return `${trip.title} — ${trip.durationDays} хоног, ${price}; ${dates}`;
}
