import type { Metadata } from "next";

import { prisma } from "@/server/prisma";
import { TRIP_INCLUDE } from "@/server/tripInput";
import type { Trip } from "@/types/trip";
import TripsPageClient from "./TripsPageClient";

export const metadata: Metadata = {
  title: "Бүх аялал",
  description:
    "Uudam Travel-ийн бүх аяллын багц нэг дороос. Чиглэл, үнэ, хугацаагаар шүүж өөрт тохирох аялалаа олоорой.",
  openGraph: {
    title: "Бүх аялал · Uudam Travel",
    description: "Чиглэл, үнэ, хугацаагаар шүүж өөрт тохирох аялалаа олоорой.",
    type: "website",
  },
};

/**
 * Same query and ordering as the unfiltered `GET /api/trips`, so the value
 * handed to the client is identical to what its first fetch would have
 * returned. Without this the catalogue rendered an empty shell — no cards, no
 * result count, and not even the destination/month controls, since those are
 * derived from the trips themselves.
 */
async function publishedTrips(): Promise<Trip[]> {
  const trips = await prisma.trip.findMany({
    where: { isPublished: true },
    include: TRIP_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  // Matches NextResponse.json: Dates become ISO strings, as the client type expects.
  return JSON.parse(JSON.stringify(trips)) as Trip[];
}

/**
 * Without this the page is prerendered once at build time and its data is
 * frozen until the next deploy — staff edit trips daily, and the departures
 * cutoff is a `new Date()` that would freeze with it.
 */
export const revalidate = 60;

export default async function TripsPage() {
  return <TripsPageClient initialTrips={await publishedTrips()} />;
}
