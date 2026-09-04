"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

import { useTrips } from "@/hooks/useTrips";
import { useSavedTrips } from "@/lib/saved";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import TripCard from "@/components/trip/TripCard";
import type { Trip } from "@/types/trip";

export default function SavedPageClient({ initialTrips }: { initialTrips?: Trip[] }) {
  const { locale } = useI18n();
  const { slugs } = useSavedTrips();
  const { data: trips } = useTrips(undefined, initialTrips);

  // Saved order, not catalogue order — most recently saved first.
  const saved = slugs
    .map((slug) => trips?.find((trip) => trip.slug === slug))
    .filter((trip): trip is Trip => Boolean(trip));

  return (
    <div className="uudam-container py-8">
      <header>
        <h1 className="text-2xl font-bold md:text-3xl">Хадгалсан аялал</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Энэ жагсаалт зөвхөн энэ төхөөрөмж дээр хадгалагдана.
        </p>
      </header>

      {saved.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border py-16 text-center">
          <Heart className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Хадгалсан аялал алга</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Аяллын зураг дээрх ♡ товчийг дарж дараа үзэхээр хадгална уу.
          </p>
          <Link
            href={`/${locale}/trips`}
            className="mt-5 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Аялал үзэх
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {saved.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}
