import { prisma } from "./prisma";
import { cached } from "./cache";

/**
 * Keyword search over the live trip catalog.
 *
 * Deliberately free of any hardcoded trip name, price or date: everything is
 * matched against whatever is in the database, so deleting or renaming a trip
 * can never break this. The only literals here are language-level (month
 * names, "cheap", "with kids") which are properties of Mongolian, not of the
 * catalog.
 */

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
  departures: { startDate: Date }[];
  category: { categoryName: string } | null;
};

export async function loadSearchableTrips(): Promise<SearchableTrip[]> {
  return cached("trips:search", 30_000, () =>
    prisma.trip.findMany({
      where: { isPublished: true },
      take: 120,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        price: true,
        image: true,
        country: true,
        city: true,
        destinations: true,
        durationDays: true,
        category: { select: { categoryName: true } },
        departures: {
          where: { startDate: { gte: new Date() }, status: { notIn: ["CANCELLED", "DEPARTED"] } },
          orderBy: { startDate: "asc" },
          select: { startDate: true },
        },
      },
    }),
  );
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

function parseMonth(text: string): number | null {
  for (const [needle, month] of Object.entries(MONTHS)) {
    if (text.includes(needle)) return month;
  }
  return null;
}

function parseDuration(text: string): number | null {
  const match = text.match(/(\d{1,2})\s*(хоног|өдөр|day|days)/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

export type ScoredTrip = { trip: SearchableTrip; score: number };

/**
 * Score trips against a free-text question. Returns only positive matches, so
 * "I have no idea what you mean" stays distinguishable from "here's something".
 */
export function searchTrips(question: string, trips: SearchableTrip[]): ScoredTrip[] {
  const text = question.toLowerCase().trim();
  if (!text) return [];

  const budget = parseBudget(text);
  const month = parseMonth(text);
  const duration = parseDuration(text);
  const wantsCheap = /хямд|хямдхан|хамгийн бага|cheap/.test(text);

  const words = text
    .split(/[\s,.!?«»"'()]+/)
    .filter((word) => word.length >= 3);

  const scored = trips.map((trip) => {
    let score = 0;

    const haystack = [
      trip.title,
      trip.summary ?? "",
      trip.country ?? "",
      trip.city ?? "",
      trip.category?.categoryName ?? "",
      ...trip.destinations,
    ]
      .join(" ")
      .toLowerCase();

    for (const word of words) {
      if (haystack.includes(word)) score += 3;
    }

    // A place name matching exactly is much stronger evidence than a stray word.
    const places = [trip.country, trip.city, ...trip.destinations]
      .filter((place): place is string => Boolean(place))
      .map((place) => place.toLowerCase());

    if (places.some((place) => text.includes(place))) score += 8;

    if (budget && trip.price <= budget) score += 4;
    if (budget && trip.price > budget) score -= 6;

    if (month && trip.departures.some((dep) => dep.startDate.getMonth() + 1 === month)) {
      score += 6;
    }

    if (duration && Math.abs(trip.durationDays - duration) <= 1) score += 4;

    return { trip, score };
  });

  const positive = scored.filter((entry) => entry.score > 0);

  if (wantsCheap) {
    // "cheapest" is a sort instruction, not a filter — fall back to the whole
    // catalog when nothing else in the question narrowed it down.
    const pool = positive.length ? positive : scored;
    return [...pool].sort((a, b) => a.trip.price - b.trip.price).slice(0, 3);
  }

  return positive.sort((a, b) => b.score - a.score).slice(0, 3);
}
