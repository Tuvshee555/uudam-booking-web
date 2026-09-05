import { prisma } from "./prisma";
import { httpError } from "./http";

/**
 * Parsing + validation for the trip payloads the admin panel sends.
 *
 * Kept in one place because create and update must agree exactly: a field the
 * two normalise differently shows up as data that silently changes shape on
 * the second save.
 */

const CYRILLIC_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", ө: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ү: "u", ф: "f", х: "h", ц: "ts", ч: "ch",
  ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/**
 * Drop Unicode combining marks (the accents NFD splits off, é -> e + U+0301).
 * Done by codepoint rather than a regex range so the source file can be
 * re-encoded by any editor without quietly breaking the match.
 */
function stripCombiningMarks(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x0300 && code <= 0x036f) continue;
    out += char;
  }
  return out;
}

/**
 * URL slug from a title. Mongolian titles are Cyrillic, which would otherwise
 * strip down to an empty slug, so those characters are transliterated first.
 */
export function slugify(input: string, fallbackPrefix = "trip"): string {
  const transliterated = input
    .toLowerCase()
    .split("")
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join("");

  const slug = stripCombiningMarks(transliterated.normalize("NFD"))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || `${fallbackPrefix}-${Date.now()}`;
}

/** Find a free slug, suffixing -2, -3 … when the base is taken. */
export async function uniqueSlug(base: string, excludeId?: string) {
  let candidate = base;
  let counter = 2;

  for (;;) {
    const existing = await prisma.trip.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) return candidate;

    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

export function toStringArray(value: unknown, maxItems = 40): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)
    .slice(0, maxItems);
}

export function toOptionalBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "тийм"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "үгүй", "ugui"].includes(normalized)) return false;
  return null;
}

export function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toOptionalInt(value: unknown): number | undefined {
  const parsed = toOptionalNumber(value);
  return parsed === undefined ? undefined : Math.trunc(parsed);
}

export function toOptionalDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const DIFFICULTIES = new Set(["EASY", "MODERATE", "CHALLENGING"]);

export function toDifficulty(value: unknown) {
  const upper = String(value ?? "").toUpperCase();
  return DIFFICULTIES.has(upper) ? (upper as "EASY" | "MODERATE" | "CHALLENGING") : undefined;
}

export type ItineraryInput = {
  dayNumber: number;
  title: string;
  description: string | null;
  location: string | null;
  meals: string[];
  accommodation: string | null;
  image: string | null;
  video: string | null;
};

/**
 * Normalise the itinerary day builder's output.
 *
 * Day numbers are re-derived from array order rather than trusted, because the
 * schema has a unique (tripId, dayNumber) constraint and a client that sends
 * two "Day 2" rows would otherwise fail the whole save with a Prisma error the
 * admin can't act on.
 */
export function normalizeItinerary(value: unknown): ItineraryInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw, index) => {
      const day = raw as Record<string, unknown>;
      const title = typeof day?.title === "string" ? day.title.trim() : "";
      if (!title) return null;

      return {
        dayNumber: index + 1,
        title: title.slice(0, 200),
        description:
          typeof day?.description === "string" && day.description.trim()
            ? day.description.trim()
            : null,
        location:
          typeof day?.location === "string" && day.location.trim()
            ? day.location.trim()
            : null,
        meals: toStringArray(day?.meals, 6),
        accommodation:
          typeof day?.accommodation === "string" && day.accommodation.trim()
            ? day.accommodation.trim()
            : null,
        image: typeof day?.image === "string" && day.image.trim() ? day.image.trim() : null,
        video: typeof day?.video === "string" && day.video.trim() ? day.video.trim() : null,
      } satisfies ItineraryInput;
    })
    .filter((day): day is ItineraryInput => day !== null)
    .slice(0, 60);
}

export type DepartureInput = {
  label: string | null;
  startDate: Date;
  endDate: Date | null;
  seatsTotal: number | null;
  seatsLeft: number | null;
  price: number | null;
  childPrice: number | null;
  infantPrice: number | null;
  status: "OPEN" | "ALMOST_FULL" | "SOLD_OUT" | "CANCELLED" | "DEPARTED";
};

const DEPARTURE_STATUSES = new Set([
  "OPEN",
  "ALMOST_FULL",
  "SOLD_OUT",
  "CANCELLED",
  "DEPARTED",
]);

/**
 * Normalise departure rows. A row without a valid start date is dropped rather
 * than defaulted — silently inventing a departure date would put a wrong date
 * in front of customers.
 */
export function normalizeDepartures(value: unknown): DepartureInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw) => {
      const dep = raw as Record<string, unknown>;
      const startDate = toOptionalDate(dep?.startDate);
      if (!startDate) return null;

      const seatsTotal = toOptionalInt(dep?.seatsTotal);
      const seatsLeftRaw = toOptionalInt(dep?.seatsLeft);
      const status = String(dep?.status ?? "").toUpperCase();

      // A backwards range ("ends" before it starts) can't be shown on the
      // trip page sensibly — drop the end date rather than reject the whole
      // departure over one bad field.
      const endDateRaw = toOptionalDate(dep?.endDate) ?? null;
      const endDate = endDateRaw && endDateRaw.getTime() < startDate.getTime() ? null : endDateRaw;

      // More seats "left" than the trip has "total" is impossible — clamp
      // rather than let the storefront show something nonsensical.
      const seatsLeft =
        seatsLeftRaw !== undefined && seatsTotal !== undefined
          ? Math.min(seatsLeftRaw, seatsTotal)
          : (seatsLeftRaw ?? seatsTotal ?? null);

      return {
        label:
          typeof dep?.label === "string" && dep.label.trim()
            ? dep.label.trim().slice(0, 120)
            : null,
        startDate,
        endDate,
        seatsTotal: seatsTotal ?? null,
        // A new departure starts with every seat free; an edit keeps whatever
        // is left so existing reservations aren't wiped out by a re-save.
        seatsLeft,
        price: toOptionalNumber(dep?.price) ?? null,
        childPrice: toOptionalNumber(dep?.childPrice) ?? null,
        infantPrice: toOptionalNumber(dep?.infantPrice) ?? null,
        status: (DEPARTURE_STATUSES.has(status) ? status : "OPEN") as DepartureInput["status"],
      } satisfies DepartureInput;
    })
    .filter((dep): dep is DepartureInput => dep !== null)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .slice(0, 120);
}

/**
 * Reconcile price / oldPrice / discount so the three always agree.
 *
 * The admin form lets any two of them be filled in and derives the third, which
 * is why this can't just trust what arrives.
 */
export function reconcilePricing(input: {
  price?: unknown;
  oldPrice?: unknown;
  discount?: unknown;
}) {
  let price = toOptionalNumber(input.price);
  let oldPrice = toOptionalNumber(input.oldPrice);
  let discount = toOptionalInt(input.discount);

  if (typeof discount === "number") {
    discount = Math.min(100, Math.max(0, discount));
  }

  if (price === undefined && oldPrice !== undefined) {
    price =
      typeof discount === "number" && discount > 0
        ? Math.round(oldPrice * (1 - discount / 100))
        : oldPrice;
  }

  if (oldPrice === undefined && price !== undefined && typeof discount === "number" && discount > 0) {
    oldPrice = discount >= 100 ? price : Math.round(price / (1 - discount / 100));
  }

  if (discount === undefined && oldPrice !== undefined && price !== undefined && oldPrice > 0) {
    discount = Math.min(100, Math.max(0, Math.round(((oldPrice - price) / oldPrice) * 100)));
  }

  return { price, oldPrice, discount };
}

/** Shared include shape so every trip response looks the same. */
export const TRIP_INCLUDE = {
  category: true,
  tags: { orderBy: { name: "asc" } },
  departures: { orderBy: { startDate: "asc" } },
  itinerary: { orderBy: { dayNumber: "asc" } },
} as const;

/**
 * Trip <-> Tag is a plain implicit many-to-many with no join fields, so a
 * save always replaces the full set rather than diffing it — the same
 * "admin sends the whole list" contract as itinerary/departures. `connect`
 * on create, `set` on update (Prisma doesn't accept `set` for a fresh row).
 */
function tagIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export function toTagConnect(value: unknown) {
  return { connect: tagIds(value).map((id) => ({ id })) };
}

export function toTagSet(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return { set: tagIds(value).map((id) => ({ id })) };
}

export function toOptionalJsonObject(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

/**
 * Recompute a trip's avgRating/reviewCount from its published testimonials.
 *
 * These two fields exist on Trip so the storefront can show a rating without
 * fetching every testimonial, but they're only trustworthy if they're always
 * derived from the same rows customers actually see — a hand-typed rating
 * that outlives the testimonial that produced it is exactly the kind of
 * "site claims one thing, reality shows another" trap this catalog has been
 * bitten by before.
 */
export async function recomputeTripRating(tripId: string) {
  const agg = await prisma.testimonial.aggregate({
    where: { tripId, isPublished: true },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.trip.update({
    where: { id: tripId },
    data: {
      avgRating: agg._avg.rating ?? 0,
      reviewCount: agg._count.rating,
    },
  });
}

export function assertTitle(title: unknown): string {
  if (typeof title !== "string" || !title.trim()) {
    throw httpError(400, "Аяллын нэр шаардлагатай");
  }
  return title.trim().slice(0, 300);
}
