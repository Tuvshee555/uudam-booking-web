import type { Trip } from "@/types/trip";

type TripGallerySource = Pick<Trip, "image" | "extraImages" | "itinerary">;

/**
 * One ordered photo set for both the hero and the day-by-day program.
 * The cover/gallery photos stay first, followed by itinerary photos, while
 * exact duplicates are removed because a cover is commonly reused for a day.
 */
export function tripGalleryImages(trip: TripGallerySource): string[] {
  return Array.from(new Set(
    [trip.image, ...trip.extraImages, ...trip.itinerary.map((day) => day.image)]
      .filter((src): src is string => typeof src === "string" && src.trim().length > 0)
      .map((src) => src.trim()),
  ));
}
