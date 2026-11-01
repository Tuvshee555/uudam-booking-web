"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

import { useTrips } from "@/hooks/useTrips";
import { useSavedTrips } from "@/lib/saved";
import { canonicalPath } from "@/lib/locales";
import TripCard from "@/components/trip/TripCard";
import type { Trip } from "@/types/trip";

export default function SavedPageClient({ initialTrips }: { initialTrips?: Trip[] }) {
  const { slugs } = useSavedTrips();
  const { data: trips } = useTrips(undefined, initialTrips);

  // Saved order, not catalogue order — most recently saved first.
  const saved = slugs
    .map((slug) => trips?.find((trip) => trip.slug === slug))
    .filter((trip): trip is Trip => Boolean(trip));

  return (
    <div className="site-container pb-20 pt-10">
      {saved.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <Heart className="mx-auto h-9 w-9 text-gold-text" aria-hidden="true" />
          <p className="display-3 mt-5 text-foreground">Хадгалсан аялал алга</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Сонирхсон аяллынхаа зураг дээрх ♡ товчийг дарвал энд хадгалагдана — харьцуулах, дараа нь эргэж үзэхэд хялбар.
          </p>
          <Link href={canonicalPath("/trips")} className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground focus-ring">
            Аялал үзэх
          </Link>
        </div>
      ) : (
        <>
          <p className="text-[14px] text-muted-foreground"><span className="font-semibold text-foreground">{saved.length}</span> аялал хадгалсан</p>
          <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12">
            {saved.map((trip) => (
              <li key={trip.id}>
                <TripCard trip={trip} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
