"use client";

import { Check, Clock, Languages, MapPin, Mountain, Star, X } from "lucide-react";

import { useTrip } from "@/hooks/useTrips";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import TripMedia from "@/components/trip/TripMedia";
import EnquiryPanel from "@/components/trip/EnquiryPanel";
import { Button } from "@/components/ui/button";

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: "Хөнгөн",
  MODERATE: "Дунд",
  CHALLENGING: "Хүнд",
};

export default function TripDetailClient({ slug }: { slug: string }) {
  const { locale } = useI18n();

  const { data: trip, isLoading } = useTrip(slug);

  if (isLoading) {
    return (
      <div className="uudam-container py-10">
        <div className="h-[380px] animate-pulse rounded-2xl bg-secondary" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="uudam-container py-24 text-center">
        <h1 className="text-2xl font-bold">Аялал олдсонгүй</h1>
        <Button asChild className="mt-6">
          <a href={`/${locale}/trips`}>Бүх аялал руу буцах</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="uudam-container py-8">
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <a href={`/${locale}`} className="hover:text-primary">Нүүр</a>
        <span>/</span>
        <a href={`/${locale}/trips`} className="hover:text-primary">Аялалууд</a>
        {trip.category && (
          <>
            <span>/</span>
            <a
              href={`/${locale}/category/${trip.category.slug ?? trip.category.id}`}
              className="hover:text-primary"
            >
              {trip.category.categoryName}
            </a>
          </>
        )}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <TripMedia trip={trip} />

          <header className="mt-6">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {trip.country && (
                <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-medium">
                  <MapPin className="h-3 w-3" />
                  {[trip.city, trip.country].filter(Boolean).join(", ")}
                </span>
              )}
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-medium">
                <Clock className="h-3 w-3" />
                {trip.durationDays} хоног {trip.durationNights} шөнө
              </span>
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-medium">
                <Mountain className="h-3 w-3" />
                {DIFFICULTY_LABEL[trip.difficulty] ?? trip.difficulty}
              </span>
              {trip.reviewCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-medium">
                  <Star className="h-3 w-3 fill-gold text-gold" />
                  {trip.avgRating.toFixed(1)} ({trip.reviewCount})
                </span>
              )}
            </div>

            <h1 className="mt-3 text-2xl font-bold leading-tight md:text-3xl">{trip.title}</h1>
            {trip.summary && (
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {trip.summary}
              </p>
            )}
          </header>

          {trip.highlights.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">Онцлох мөчүүд</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {trip.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-bold">Аяллын тухай</h2>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
              {trip.description}
            </p>
          </section>

          {trip.itinerary.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">Өдөр тутмын хөтөлбөр</h2>
              <ol className="mt-4 space-y-0">
                {trip.itinerary.map((day, index) => (
                  <li key={day.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {/* Timeline rail, hidden on the last day so it doesn't
                        trail off into nothing. */}
                    {index < trip.itinerary.length - 1 && (
                      <span className="absolute left-[15px] top-9 h-full w-px bg-border" />
                    )}
                    <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {day.dayNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-semibold">{day.title}</h3>
                      {day.location && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {day.location}
                        </div>
                      )}
                      {day.description && (
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {day.description}
                        </p>
                      )}
                      {(day.meals.length > 0 || day.accommodation) && (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                          {day.meals.map((meal) => (
                            <span key={meal} className="rounded-full bg-secondary px-2 py-0.5">
                              🍽 {meal}
                            </span>
                          ))}
                          {day.accommodation && (
                            <span className="rounded-full bg-secondary px-2 py-0.5">
                              🏨 {day.accommodation}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(trip.included.length > 0 || trip.excluded.length > 0) && (
            <section className="mt-8 grid gap-6 sm:grid-cols-2">
              {trip.included.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold">Багцад багтсан</h2>
                  <ul className="mt-3 space-y-2">
                    {trip.included.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {trip.excluded.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold">Багцад ороогүй</h2>
                  <ul className="mt-3 space-y-2">
                    {trip.excluded.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {(trip.transport.length > 0 || trip.languages.length > 0 || trip.meetingPoint) && (
            <section className="mt-8 rounded-2xl border border-border p-5">
              <h2 className="text-lg font-bold">Бэлтгэл мэдээлэл</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {trip.transport.length > 0 && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Тээвэр
                    </dt>
                    <dd className="mt-1 text-sm">{trip.transport.join(", ")}</dd>
                  </div>
                )}
                {trip.languages.length > 0 && (
                  <div>
                    <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Languages className="h-3 w-3" />
                      Хөтчийн хэл
                    </dt>
                    <dd className="mt-1 text-sm">{trip.languages.join(", ")}</dd>
                  </div>
                )}
                {trip.meetingPoint && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Цугларах цэг
                    </dt>
                    <dd className="mt-1 text-sm">{trip.meetingPoint}</dd>
                  </div>
                )}
                {trip.requirements && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Шаардлага
                    </dt>
                    <dd className="mt-1 whitespace-pre-line text-sm">{trip.requirements}</dd>
                  </div>
                )}
                {trip.cancellationPolicy && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Цуцлалтын нөхцөл
                    </dt>
                    <dd className="mt-1 whitespace-pre-line text-sm">{trip.cancellationPolicy}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {trip.mapUrl && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">Байршил</h2>
              <div className="mt-3 aspect-video overflow-hidden rounded-2xl border border-border">
                <iframe
                  src={trip.mapUrl}
                  title={`${trip.title} байршил`}
                  className="h-full w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-[124px] lg:h-fit">
          <EnquiryPanel trip={trip} />
        </aside>
      </div>
    </div>
  );
}
