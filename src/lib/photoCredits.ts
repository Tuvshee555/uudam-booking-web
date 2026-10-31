import { tripGalleryImages } from "./tripMedia";
import type { Trip } from "@/types/trip";

/**
 * Attribution for licensed photos (Wikimedia Commons, CC BY / CC BY-SA), kept
 * by the chatbot in extra.photo_credits and projected into sourceMetadata.
 * Those licenses require crediting the author, the license and the source
 * wherever the photo is shown.
 */
export type PhotoCredit = {
  src: string;
  subject: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  page: string | null;
  provider: string;
};

type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const link = (value: unknown) => /^https:\/\//.test(text(value)) ? text(value) : null;

type CreditSource = Pick<Trip, "image" | "extraImages" | "itinerary" | "sourceMetadata">;

/** Credits for the photos this trip page actually shows, in gallery order. */
export function photoCreditsFor(trip: CreditSource): PhotoCredit[] {
  const credits = record(record(trip.sourceMetadata).photo_credits);
  return tripGalleryImages(trip).flatMap((src) => {
    const entry = record(credits[src]);
    const license = text(entry.license);
    if (!license) return [];
    return [{
      src,
      subject: text(entry.subject) || text(entry.title),
      author: text(entry.author),
      license,
      licenseUrl: link(entry.licenseUrl),
      page: link(entry.page),
      provider: text(entry.provider) || "Wikimedia Commons",
    }];
  });
}

/** What a credited photo shows (its alt text); the fallback for any other photo. */
export function photoAlt(trip: Pick<Trip, "sourceMetadata">, src: string, fallback: string): string {
  const entry = record(record(record(trip.sourceMetadata).photo_credits)[src]);
  return text(entry.subject) || fallback;
}
