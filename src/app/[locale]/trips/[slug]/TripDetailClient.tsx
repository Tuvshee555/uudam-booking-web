"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Image from "next/image";
import {
  AlertCircle,
  BedDouble,
  Check,
  Clock,
  FileDown,
  FileText,
  Languages,
  MapPin,
  Mountain,
  ReceiptText,
  Star,
  Utensils,
  X,
} from "lucide-react";

import { useTrip, useTrips } from "@/hooks/useTrips";
import type { Trip } from "@/types/trip";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { recordRecentlyViewed } from "@/lib/analytics";
import TripMedia from "@/components/trip/TripMedia";
import TripCard from "@/components/trip/TripCard";
import EnquiryPanel from "@/components/trip/EnquiryPanel";
import ShareButton from "@/components/trip/ShareButton";
import SaveButton from "@/components/trip/SaveButton";
import { Button } from "@/components/ui/button";

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: "Хөнгөн",
  MODERATE: "Дунд",
  CHALLENGING: "Хүнд",
};

export default function TripDetailClient({
  slug,
  initialTrip,
}: {
  slug: string;
  /**
   * The trip the server page already fetched. Seeding the query with it is what
   * puts the itinerary, price and departures into the initial HTML instead of
   * leaving a shell until the browser refetches.
   */
  initialTrip?: Trip;
}) {
  const { locale } = useI18n();

  const { data: trip, isLoading } = useTrip(slug, initialTrip);
  const { data: allTrips } = useTrips();

  const related = useMemo(() => {
    if (!trip || !allTrips) return [];

    const shareTag = (candidate: (typeof allTrips)[number]) =>
      candidate.tags.some((tag) => trip.tags.some((t) => t.id === tag.id));

    return allTrips
      .filter((candidate) => candidate.id !== trip.id)
      .filter((candidate) => (trip.categoryId && candidate.categoryId === trip.categoryId) || shareTag(candidate))
      .slice(0, 4);
  }, [trip, allTrips]);

  /**
   * Anchors for the sticky section nav. Built from the same conditions the
   * sections themselves render under, so the nav can never link to a heading
   * that isn't on the page — trip content varies a lot across the catalogue.
   */
  const sections = useMemo(() => {
    if (!trip) return [];

    return [
      trip.highlights.length > 0 && { id: "highlights", label: "Онцлох" },
      { id: "about", label: "Тухай" },
      trip.itinerary.length > 0 && { id: "itinerary", label: "Хөтөлбөр" },
      (trip.included.length > 0 || trip.excluded.length > 0) && {
        id: "included",
        label: "Багц",
      },
      (trip.transport.length > 0 ||
        trip.languages.length > 0 ||
        trip.meetingPoint ||
        trip.hotel ||
        trip.foodIncluded !== null ||
        trip.departureRule) && { id: "notes", label: "Бэлтгэл" },
      trip.testimonials && trip.testimonials.length > 0 && { id: "reviews", label: "Сэтгэгдэл" },
    ].filter((entry): entry is { id: string; label: string } => Boolean(entry));
  }, [trip]);

  useEffect(() => {
    if (trip) recordRecentlyViewed(trip.slug);
  }, [trip]);

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

            <div className="mt-3 flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold leading-tight md:text-3xl">{trip.title}</h1>
              <div className="mt-1 flex shrink-0 items-center gap-2">
                <SaveButton slug={trip.slug} variant="button" />
                <ShareButton title={trip.title} />
              </div>
            </div>
            {trip.summary && (
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {trip.summary}
              </p>
            )}
          </header>

          {trip.brochurePdfUrl && (
            <a
              href={trip.brochurePdfUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
            >
              <FileDown className="h-4 w-4" />
              Хөтөлбөр татах
            </a>
          )}

          {sections.length > 1 && (
            <nav
              aria-label="Хуудасны хэсгүүд"
              className="sticky top-[72px] z-20 -mx-4 mt-6 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            >
              <ul className="no-scrollbar flex gap-1 overflow-x-auto py-2">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="inline-block shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      {section.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {trip.highlights.length > 0 && (
            <section id="highlights" className="mt-8 scroll-mt-28">
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

          <section id="about" className="mt-8 scroll-mt-28">
            <h2 className="text-lg font-bold">Аяллын тухай</h2>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
              {trip.description}
            </p>
          </section>

          {trip.itinerary.length > 0 && (
            <section id="itinerary" className="mt-8 scroll-mt-28">
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
                      {day.image && (
                        <div className="relative mt-3 aspect-[16/9] w-full max-w-xl overflow-hidden rounded-lg bg-secondary">
                          <Image
                            src={day.image}
                            alt={day.title}
                            fill
                            sizes="(max-width: 640px) 100vw, 576px"
                            className="object-cover"
                          />
                        </div>
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
            <section id="included" className="mt-8 grid scroll-mt-28 gap-6 sm:grid-cols-2">
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

          {(trip.importantNotes.length > 0 ||
            trip.extraFees.length > 0 ||
            trip.roomPrices.length > 0 ||
            trip.childPriceNotes.length > 0 ||
            trip.brochurePdfUrl) && (
            <section className="mt-8 space-y-5">
              {trip.importantNotes.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    <AlertCircle className="h-5 w-5" />
                    Чухал тэмдэглэл
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                    {trip.importantNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(trip.extraFees.length > 0 || trip.roomPrices.length > 0 || trip.childPriceNotes.length > 0) && (
                <div className="grid gap-5 md:grid-cols-3">
                  {trip.extraFees.length > 0 && (
                    <InfoList icon={<ReceiptText className="h-4 w-4" />} title="Нэмэлт төлбөр" items={trip.extraFees} />
                  )}
                  {trip.roomPrices.length > 0 && (
                    <InfoList icon={<BedDouble className="h-4 w-4" />} title="Өрөөний үнэ" items={trip.roomPrices} />
                  )}
                  {trip.childPriceNotes.length > 0 && (
                    <InfoList icon={<ReceiptText className="h-4 w-4" />} title="Хүүхдийн үнэ" items={trip.childPriceNotes} />
                  )}
                </div>
              )}

              {trip.brochurePdfUrl && (
                <Button asChild variant="outline" className="gap-2">
                  <a href={trip.brochurePdfUrl} target="_blank" rel="noreferrer">
                    <FileText className="h-4 w-4" />
                    PDF брошур үзэх
                  </a>
                </Button>
              )}
            </section>
          )}

          {(trip.transport.length > 0 ||
            trip.languages.length > 0 ||
            trip.meetingPoint ||
            trip.hotel ||
            trip.foodIncluded !== null ||
            trip.departureRule) && (
            <section id="notes" className="mt-8 scroll-mt-28 rounded-2xl border border-border p-5">
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
                {trip.hotel && (
                  <div>
                    <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <BedDouble className="h-3 w-3" />
                      Зочид буудал
                    </dt>
                    <dd className="mt-1 text-sm">{trip.hotel}</dd>
                  </div>
                )}
                {trip.foodIncluded !== null && (
                  <div>
                    <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Utensils className="h-3 w-3" />
                      Хоол
                    </dt>
                    <dd className="mt-1 text-sm">
                      {trip.foodIncluded ? "Хөтөлбөрт багтсан" : "Хөтөлбөрт багтаагүй"}
                    </dd>
                  </div>
                )}
                {trip.departureRule && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Гарах өдрийн дүрэм
                    </dt>
                    <dd className="mt-1 whitespace-pre-line text-sm">{trip.departureRule}</dd>
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

          {trip.testimonials && trip.testimonials.length > 0 && (
            <section id="reviews" className="mt-8 scroll-mt-28">
              <h2 className="text-lg font-bold">Харилцагчийн сэтгэгдэл</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {trip.testimonials.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-gold text-gold" />
                      ))}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.comment}</p>
                    <p className="mt-2 text-xs font-semibold">{t.authorName}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-[124px] lg:h-fit">
          <EnquiryPanel trip={trip} />
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold">Санал болгох аялалууд</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((candidate) => (
              <TripCard key={candidate.id} trip={candidate} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function InfoList({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-border p-5">
      <h2 className="flex items-center gap-2 text-base font-bold">
        {icon}
        {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-relaxed text-muted-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
