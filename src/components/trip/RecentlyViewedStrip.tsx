"use client";

import { useEffect, useState } from "react";

import { useTrips } from "@/hooks/useTrips";
import { getRecentlyViewed } from "@/lib/analytics";
import SectionHeading from "@/components/site/SectionHeading";
import TripCard from "./TripCard";

/**
 * Trips the visitor already opened, most recent first — read from
 * localStorage so it costs no extra request. Read after mount only: the
 * server render always has an empty list, and reading localStorage during
 * render would mismatch server/client HTML.
 */
export default function RecentlyViewedStrip({ exclude }: { exclude?: string }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const { data: trips } = useTrips();

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSlugs(getRecentlyViewed()), []);

  if (slugs.length === 0 || !trips) return null;

  const ordered = slugs
    .filter((slug) => slug !== exclude)
    .map((slug) => trips.find((trip) => trip.slug === slug))
    .filter((trip): trip is NonNullable<typeof trip> => Boolean(trip))
    .slice(0, 4);

  if (ordered.length === 0) return null;

  return (
    <section aria-labelledby="recent-title" className="site-container pt-20 lg:pt-28" data-print="hide">
      <SectionHeading id="recent-title" eyebrow="Таны үзсэн" title="Сүүлд үзсэн аялалууд" />
      <ul className="mt-10 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6">
        {ordered.map((trip) => (
          <li key={trip.id}>
            <TripCard trip={trip} />
          </li>
        ))}
      </ul>
    </section>
  );
}
