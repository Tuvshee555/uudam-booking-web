"use client";

import { useEffect, useState } from "react";

import { useTrips } from "@/hooks/useTrips";
import { getRecentlyViewed } from "@/lib/analytics";
import TripCard from "./TripCard";

/**
 * Trips the visitor already opened, most recent first — read from
 * localStorage so it costs no extra request. Read after mount only: the
 * server render always has an empty list, and reading localStorage during
 * render would mismatch server/client HTML.
 */
export default function RecentlyViewedStrip() {
  const [slugs, setSlugs] = useState<string[]>([]);
  const { data: trips } = useTrips();

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSlugs(getRecentlyViewed()), []);

  if (slugs.length === 0 || !trips) return null;

  const ordered = slugs
    .map((slug) => trips.find((trip) => trip.slug === slug))
    .filter((trip): trip is NonNullable<typeof trip> => Boolean(trip))
    .slice(0, 4);

  if (ordered.length === 0) return null;

  return (
    <section className="uudam-container py-10">
      <h2 className="text-2xl font-bold md:text-3xl">Сүүлд үзсэн аялалууд</h2>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ordered.map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </section>
  );
}
