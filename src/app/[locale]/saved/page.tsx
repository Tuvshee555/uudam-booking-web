import type { Metadata } from "next";

import { prisma } from "@/server/prisma";
import { TRIP_INCLUDE } from "@/server/tripInput";
import type { Trip } from "@/types/trip";
import SavedPageClient from "./SavedPageClient";

export const metadata: Metadata = {
  title: "Хадгалсан аялал",
  description: "Дараа үзэхээр хадгалсан аяллууд.",
  // The list lives in the visitor's browser, so there is nothing here for a
  // crawler and nothing that should ever surface in search.
  robots: { index: false, follow: true },
};

/**
 * Without this the page is prerendered once at build time and its data is
 * frozen until the next deploy — staff edit trips daily, and the departures
 * cutoff is a `new Date()` that would freeze with it.
 */
export const revalidate = 60;

export default async function SavedPage() {
  const trips = await prisma.trip.findMany({
    where: { isPublished: true },
    include: TRIP_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return <SavedPageClient initialTrips={JSON.parse(JSON.stringify(trips)) as Trip[]} />;
}
