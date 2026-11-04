import type { Departure } from "@/types/trip";

type DigestDeparture = Pick<Departure, "id" | "startDate" | "status"> &
  Partial<Pick<Departure, "endDate" | "label" | "seatsTotal" | "seatsLeft" | "price" | "childPrice" | "infantPrice">>;

/**
 * A short fingerprint of a trip's dates exactly as its page carries them:
 * every field of every departure, in id order (dates on the same day come
 * back from the database in no fixed order).
 *
 * The trip page sends the one it was built with to
 * /api/trips/[id]/availability, which compares it with the database: a
 * mismatch means the cached page is behind — a change that did not refresh it,
 * such as one the chatbot wrote straight into the database.
 *
 * FNV-1a, 32 bits: a cheap change detector, not a security measure.
 */
export function departureDigest(departures: DigestDeparture[]): string {
  const text = [...departures]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((departure) =>
      JSON.stringify([
        departure.id,
        departure.startDate,
        departure.endDate ?? null,
        departure.label ?? null,
        departure.status,
        departure.seatsTotal ?? null,
        departure.seatsLeft ?? null,
        departure.price ?? null,
        departure.childPrice ?? null,
        departure.infantPrice ?? null,
      ]),
    )
    .join("\n");

  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
