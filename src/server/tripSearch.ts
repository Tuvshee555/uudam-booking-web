import { prisma } from "./prisma";
import { cached } from "./cache";
import type { SearchableTrip } from "@/lib/tripAdvisor";

export type { SearchableTrip } from "@/lib/tripAdvisor";
export { searchTrips } from "@/lib/tripAdvisor";

/**
 * The published catalog as the on-site advisor reads it — the same Trip and
 * Departure rows the pages render, never a copy. Kept 15 s per server
 * instance; an admin save clears it at once on that instance
 * (invalidateCatalog), so an answer is at most 15 s behind a save elsewhere.
 */
export async function loadSearchableTrips(): Promise<SearchableTrip[]> {
  return cached("trips:search", 15_000, () =>
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
        categories: { select: { categoryName: true } },
        departures: {
          where: { startDate: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, status: { notIn: ["CANCELLED", "DEPARTED"] } },
          orderBy: { startDate: "asc" },
          select: { id: true, startDate: true, price: true, status: true, seatsLeft: true },
        },
      },
    }),
  );
}
