"use client";

import { useCategoryTrips } from "@/hooks/useTrips";
import TripCard from "@/components/trip/TripCard";
import { useI18n } from "@/components/i18n/ClientI18nProvider";

export default function CategoryPageClient({ id }: { id: string }) {
  const { locale } = useI18n();
  const { data, isLoading } = useCategoryTrips(id);

  return (
    <div className="uudam-container py-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <a href={`/${locale}`} className="hover:text-primary">Нүүр</a>
        <span>/</span>
        <a href={`/${locale}/trips`} className="hover:text-primary">Аялалууд</a>
      </nav>

      <h1 className="text-2xl font-bold md:text-3xl">
        {data?.category.categoryName ?? "Ангилал"}
      </h1>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-[380px] animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : !data?.trips.length ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Энэ ангилалд одоогоор аялал алга байна.
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{data.trips.length} аялал</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {data.trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
