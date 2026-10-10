"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  AlertCircle,
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
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

import { useTrip, useTrips, useSiteSettings } from "@/hooks/useTrips";
import type { Trip } from "@/types/trip";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { recordRecentlyViewed } from "@/lib/analytics";
import { formatTripTitle } from "@/lib/tripDisplay";
import { availability, nextBookableDeparture, nextDeparture, upcomingDepartures } from "@/lib/departures";
import {
  isSoldOutDeparture,
  saleBadgeLabel,
} from "@/lib/tripMarketing";
import { parseMediaItems } from "@/lib/media";
import TripMedia from "@/components/trip/TripMedia";
import MediaGallery from "@/components/trip/MediaGallery";
import TripWeather, { useTripWeather } from "@/components/trip/TripWeather";
import RouteMap, { type RouteStop } from "@/components/trip/RouteMap";
import TripCard from "@/components/trip/TripCard";
import TripSidebar from "@/components/trip/TripSidebar";
import StickyHandoffSidebar from "@/components/trip/StickyHandoffSidebar";
import EnquiryTrustNote from "@/components/trust/EnquiryTrustNote";
import ShareButton from "@/components/trip/ShareButton";
import SaveButton from "@/components/trip/SaveButton";
import DownloadTripButton from "@/components/trip/DownloadTripButton";
import MessengerButton from "@/components/trip/MessengerButton";
import { Button } from "@/components/ui/button";

/**
 * Trips imported from the chatbot project carry sourceTripId="trip-<poster
 * id>" — reusing its poster-pdf endpoint means every migrated trip gets a
 * real, photo-filled itinerary download without staff uploading a separate
 * brochurePdfUrl (which is what brochurePdfUrl-only trips fall back to).
 */
function chatbotPosterPdfUrl(sourceTripId: string | null): string | null {
  if (!sourceTripId?.startsWith("trip-")) return null;
  const base = process.env.NEXT_PUBLIC_CHATBOT_URL;
  if (!base) return null;
  const posterId = sourceTripId.slice("trip-".length);
  return `${base}/api/poster-pdf?id=${encodeURIComponent(posterId)}`;
}

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: "Хөнгөн",
  MODERATE: "Дунд",
  CHALLENGING: "Хүнд",
};

function noticeLines(value?: string | null) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function closestSelectableDepartureDate(trip: Trip): string | undefined {
  return upcomingDepartures(trip).find((departure) => availability(departure).selectable)?.startDate.slice(0, 10);
}

const MEAL_SLOTS = [
  { match: /өглөө/i, label: "Өглөөний цай" },
  { match: /өдөр/i, label: "Өдрийн хоол" },
  { match: /орой/i, label: "Оройн хоол" },
] as const;

function ItineraryAccordion({ days }: { days: Trip["itinerary"] }) {
  const [openDayId, setOpenDayId] = useState<string | null>(() => days[0]?.id ?? null);
  // A trip whose days carry no meal data at all says nothing about meals; once any
  // day has them, every day shows all three so a missing meal reads as "not included".
  const showMeals = days.some((day) => day.meals.length > 0);

  return (
    <ol className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
      {days.map((day) => {
        const open = openDayId === day.id;
        return (
          <li key={day.id}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenDayId(open ? null : day.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50 sm:px-5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {day.dayNumber}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-snug text-primary">{day.title}</span>
                {day.location && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{day.location}</span>}
              </span>
              <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="min-h-0 overflow-hidden">
                <div className="border-t border-border px-4 pb-4 pt-3 sm:px-5">
                {day.description && <p className="whitespace-pre-line text-[15px] leading-7 text-foreground/80">{day.description}</p>}
                {day.image && (
                  <div className="relative mt-3 aspect-[16/9] w-full max-w-xl overflow-hidden rounded-lg bg-secondary">
                    <Image src={day.image} alt={day.title} fill sizes="(max-width: 640px) 100vw, 576px" className="uudam-photo-drift object-cover" />
                  </div>
                )}
                {day.video && <video src={day.video} controls preload="metadata" playsInline className="mt-3 aspect-video w-full max-w-xl rounded-lg bg-black print:hidden" />}
                {showMeals && (
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]" aria-label="Хоол">
                    {MEAL_SLOTS.map(({ match, label }) => {
                      const included = day.meals.some((meal) => match.test(meal));
                      return (
                        <li
                          key={label}
                          className={`flex items-center gap-1.5 ${included ? "font-medium text-foreground" : "text-muted-foreground"}`}
                        >
                          {included ? (
                            <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
                          )}
                          <span>{label}</span>
                          <span className="sr-only">{included ? "багтсан" : "багтаагүй"}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {day.accommodation && (
                  <p className="mt-2 flex items-center gap-1.5 text-[13px] text-foreground/80">
                    <BedDouble className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {day.accommodation}
                  </p>
                )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function TripDetailClient({
  slug,
  initialTrip,
  initialSiteSettings,
  selectedDate,
}: {
  slug: string;
  selectedDate?: string;
  /**
   * The trip the server page already fetched. Seeding the query with it is what
   * puts the itinerary, price and departures into the initial HTML instead of
   * leaving a shell until the browser refetches.
   */
  initialTrip?: Trip;
  initialSiteSettings?: { tripNotice: string | null };
}) {
  const { locale } = useI18n();

  const { data: trip, isLoading } = useTrip(slug, initialTrip);
  const { data: siteSettings } = useSiteSettings(initialSiteSettings);
  const { data: allTrips } = useTrips();

  const related = useMemo(() => {
    if (!trip || !allTrips) return [];

    const tripCategoryIds = new Set([
      trip.categoryId,
      ...trip.categories.map((category) => category.id),
    ].filter((id): id is string => Boolean(id)));

    const shareTag = (candidate: (typeof allTrips)[number]) =>
      candidate.tags.some((tag) => trip.tags.some((t) => t.id === tag.id));

    const shareCategory = (candidate: (typeof allTrips)[number]) => {
      const candidateCategoryIds = [
        candidate.categoryId,
        ...candidate.categories.map((category) => category.id),
      ].filter((id): id is string => Boolean(id));

      return candidateCategoryIds.some((id) => tripCategoryIds.has(id));
    };

    return allTrips
      .filter((candidate) => candidate.id !== trip.id)
      .filter((candidate) => shareCategory(candidate) || shareTag(candidate))
      .slice(0, 4);
  }, [trip, allTrips]);

  const hotelMedia = useMemo(() => parseMediaItems(trip?.hotelMedia) ?? [], [trip]);
  const travelerMedia = useMemo(() => parseMediaItems(trip?.travelerMedia) ?? [], [trip]);
  const siteNoticeLines = useMemo(
    () => noticeLines(siteSettings?.tripNotice),
    [siteSettings?.tripNotice],
  );
  // One source of truth: the weather, calendar, price, and enquiry all use
  // this same departure. Keeping it here prevents sibling panels drifting.
  const [chosenDepartureDate, setChosenDepartureDate] = useState<string | undefined>(selectedDate);
  const activeDepartureDate = chosenDepartureDate ?? (trip ? closestSelectableDepartureDate(trip) : undefined);
  const { data: weather } = useTripWeather(trip?.slug, activeDepartureDate);
  const hasWeather = Boolean(weather?.days.some((d) => d.hi !== null));
  const routeStops = useMemo<RouteStop[]>(() => {
    if (!weather) return [];
    return weather.places.map((place, index) => {
      const dayNumbers = weather.days.filter((d) => d.place === index).map((d) => d.day);
      const first = dayNumbers[0];
      const last = dayNumbers[dayNumbers.length - 1];
      return {
        ...place,
        days: first === undefined ? undefined : first === last ? `${first}-р өдөр` : `${first}–${last}-р өдөр`,
      };
    });
  }, [weather]);

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
      routeStops.length > 0 && { id: "route", label: "Маршрут" },
      hasWeather && { id: "weather", label: "Цаг агаар" },
      (trip.included.length > 0 || trip.excluded.length > 0) && {
        id: "included",
        label: "Багц",
      },
      (siteNoticeLines.length > 0 ||
        trip.importantNotes.length > 0 ||
        trip.extraFees.length > 0 ||
        trip.roomPrices.length > 0 ||
        trip.childPriceNotes.length > 0 ||
        trip.brochurePdfUrl) && { id: "important", label: "Чухал" },
      (trip.transport.length > 0 ||
        trip.languages.length > 0 ||
        trip.meetingPoint ||
        trip.hotel ||
        hotelMedia.length > 0 ||
        trip.foodIncluded !== null ||
        trip.departureRule) && { id: "notes", label: "Бэлтгэл" },
      travelerMedia.length > 0 && { id: "traveler-media", label: "Аялагчид" },
      trip.testimonials && trip.testimonials.length > 0 && { id: "reviews", label: "Сэтгэгдэл" },
    ].filter((entry): entry is { id: string; label: string } => Boolean(entry));
  }, [trip, siteNoticeLines, hotelMedia, travelerMedia, hasWeather, routeStops]);

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

  const detailSaleLabel = saleBadgeLabel(trip);
  const selectableDeparture = nextBookableDeparture(trip);
  const detailSoldOut = !selectableDeparture && isSoldOutDeparture(nextDeparture(trip));
  const mobileCtaClosed = detailSoldOut && !selectableDeparture;

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

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]" data-trip-layout-grid>
        <div className="min-w-0" data-trip-layout-main>
          <TripMedia trip={trip} />

          <header className="mt-6">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {detailSaleLabel && (
                <span className="rounded-full bg-destructive px-2.5 py-1 font-bold text-destructive-foreground">
                  {detailSaleLabel}
                </span>
              )}
              {detailSoldOut && (
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 font-bold text-destructive ring-1 ring-destructive/20">
                  Суудал дүүрсэн
                </span>
              )}
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

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h1 className="text-2xl font-bold leading-tight md:text-3xl">{formatTripTitle(trip.title)}</h1>
              <div className="flex flex-wrap items-center gap-2 sm:mt-1 sm:shrink-0" data-print="hide">
                <SaveButton slug={trip.slug} variant="button" />
                <ShareButton title={formatTripTitle(trip.title)} tripId={trip.id} />
                <DownloadTripButton />
              </div>
            </div>
            {trip.summary && (
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {trip.summary}
              </p>
            )}

            <a
              href="#booking-panel"
              className={
                "mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 lg:hidden " +
                (mobileCtaClosed
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground")
              }
            >
              <CalendarDays className="h-4 w-4" />
              {mobileCtaClosed ? "Суудал дүүрсэн" : "Огноо сонгох"}
            </a>
          </header>

          {(trip.brochurePdfUrl || chatbotPosterPdfUrl(trip.sourceTripId)) && (
            <a
              href={trip.brochurePdfUrl || chatbotPosterPdfUrl(trip.sourceTripId)!}
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
              data-print="hide"
              className="sticky top-[72px] z-20 -mx-4 mt-6 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            >
              <ul className="no-scrollbar flex gap-1 overflow-x-auto py-2">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="inline-block shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
            <ItineraryAccordion days={trip.itinerary} />
          </section>
          )}

          {routeStops.length > 0 && (
            <section id="route" className="mt-8 scroll-mt-28" data-print="hide">
              <h2 className="text-lg font-bold">Аяллын маршрут</h2>
              <div className="mt-4">
                <RouteMap stops={routeStops} />
              </div>
            </section>
          )}

          <div id="booking-panel" className="mt-8 scroll-mt-28 lg:hidden">
            <TripSidebar
              trip={trip}
              bankDetails={siteSettings?.bankDetails}
              selectedDate={activeDepartureDate}
              onDepartureChange={setChosenDepartureDate}
            />
            <MessengerButton tripSlug={trip.slug} tripId={trip.id} className="mt-3 w-full" />
            <EnquiryTrustNote />
          </div>

          {weather && hasWeather && (
            <section id="weather" className="mt-8 scroll-mt-28" data-print="hide">
              <h2 className="text-lg font-bold">Аяллын үеийн цаг агаар</h2>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">
                {weather.mode === "current"
                  ? "Очих хотуудын одоогийн цаг агаар — аялал ойртоход таны аяллын өдөр бүрийн мэдээ энд гарна."
                  : "Таны аялах өдрүүдэд, тухайн өдөр байх хотын цаг агаар."}
              </p>
              <TripWeather report={weather} onSelectDeparture={setChosenDepartureDate} />
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

          {(siteNoticeLines.length > 0 ||
            trip.importantNotes.length > 0 ||
            trip.extraFees.length > 0 ||
            trip.roomPrices.length > 0 ||
            trip.childPriceNotes.length > 0 ||
            trip.brochurePdfUrl) && (
            <section id="important" className="mt-8 scroll-mt-28 space-y-5">
              {(siteNoticeLines.length > 0 || trip.importantNotes.length > 0) && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    <AlertCircle className="h-5 w-5" />
                    Чухал тэмдэглэл
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                    {/* Standing, site-wide note — set once in admin, shown on
                        every trip — always comes first, then whatever is
                        specific to this one trip. */}
                    {siteNoticeLines.map((note) => (
                      <li key={`site-${note}`}>{note}</li>
                    ))}
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
                    <InfoList icon={<ReceiptText className="h-4 w-4" />} title="Үнэ, насны ангилал" items={trip.childPriceNotes} />
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
            hotelMedia.length > 0 ||
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

              {hotelMedia.length > 0 && (
                <div className="mt-5 border-t border-border pt-4">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <BedDouble className="h-3 w-3" />
                    Зочид буудлын зураг, бичлэг
                  </h3>
                  <div className="mt-3">
                    <MediaGallery items={hotelMedia} title={trip.hotel || "Зочид буудал"} />
                  </div>
                </div>
              )}
            </section>
          )}

          {travelerMedia.length > 0 && (
            <section id="traveler-media" className="mt-8 scroll-mt-28 rounded-2xl border border-border p-5">
              <h2 className="text-lg font-bold">Аялагчдын зураг, бичлэг</h2>
              <p className="mt-1 text-sm text-muted-foreground">Энэ аялалд явсан аялагчдын дурсамж.</p>
              <div className="mt-4">
                <MediaGallery items={travelerMedia} title="Аялагчдын дурсамж" />
              </div>
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

        {/*
          The booking panel (calendar + passenger counts + price) can run
          taller than the viewport on trips with many months of departures.
          Plain `sticky` pins the top edge but has no way to reach its own
          bottom once it's taller than the screen; a naive permanent
          scroll-box fights the page's own scroll the whole way down. This
          follows the pattern booking sites use instead: the box scrolls
          normally until it would run off-screen, LOCKS in place with its
          own internal scrollbar for as long as it's taller than the room
          available, then releases and scrolls away once the (much longer)
          itinerary column to its left has nothing further below it.
        */}
        <div className="hidden scroll-mt-28 lg:block">
          <StickyHandoffSidebar topOffset={124} bottomGap={20}>
            <TripSidebar
              trip={trip}
              bankDetails={siteSettings?.bankDetails}
              selectedDate={activeDepartureDate}
              onDepartureChange={setChosenDepartureDate}
            />
            <MessengerButton tripSlug={trip.slug} tripId={trip.id} className="mt-3 w-full" />
            <EnquiryTrustNote />
          </StickyHandoffSidebar>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12" data-print="hide">
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
