"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BedDouble,
  CalendarDays,
  Check,
  Clock,
  Compass,
  ExternalLink,
  FileDown,
  Languages,
  MapPin,
  Star,
  Users,
  Utensils,
  X,
} from "lucide-react";

import { useLiveDepartures, useTrip, useTrips, useSiteSettings } from "@/hooks/useTrips";
import type { Trip } from "@/types/trip";
import { recordRecentlyViewed } from "@/lib/analytics";
import { formatCategoryName, formatTripTitle, isAllCapsTitle } from "@/lib/tripDisplay";
import { availability, formatDepartureDate, startingPrice, upcomingDepartures } from "@/lib/departures";
import { hasKnownTripPrice } from "@/lib/pricing";
import { saleBadgeLabel } from "@/lib/tripMarketing";
import { tripDestinations } from "@/lib/destinations";
import { tripStatus } from "@/lib/tripStatus";
import { canonicalPath } from "@/lib/locales";
import { categoryHref } from "@/lib/siteNav";
import { parseMediaItems } from "@/lib/media";
import { splitHealthCheckup } from "@/lib/healthCheckup";
import { hotelProfilesFromData, type HotelProfile } from "@/lib/hotelLinks";
import Breadcrumbs from "@/components/site/Breadcrumbs";
import TripGallery from "@/components/trip/TripGallery";
import PhotoCredits from "@/components/trip/PhotoCredits";
import MediaGallery from "@/components/trip/MediaGallery";
import TripWeather, { useTripWeather } from "@/components/trip/TripWeather";
import RouteMap, { type RouteStop } from "@/components/trip/RouteMap";
import TripCard from "@/components/trip/TripCard";
import TripSidebar from "@/components/trip/TripSidebar";
import StickyHandoffSidebar from "@/components/trip/StickyHandoffSidebar";
import ShareButton from "@/components/trip/ShareButton";
import SaveButton from "@/components/trip/SaveButton";
import DownloadTripButton from "@/components/trip/DownloadTripButton";
import HealthCheckupSection from "@/components/trip/HealthCheckupSection";
import ItineraryTimeline from "@/components/trip/ItineraryTimeline";
import PricingSection from "@/components/trip/PricingSection";
import SectionNav, { type PageSection } from "@/components/trip/SectionNav";
import MobileTripBar from "@/components/trip/MobileTripBar";
import { ChannelLink } from "@/components/site/channels";
import { cn } from "@/lib/utils";

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
  MODERATE: "Дунд зэрэг",
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

function TripSection({ id, title, eyebrow, children, className }: { id: string; title: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-36 border-t border-border pt-12 first:border-t-0 first:pt-0 lg:scroll-mt-40", className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 id={`${id}-title`} className={cn("display-2 text-foreground", eyebrow && "mt-3")}>{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function HotelNameLink({ hotel }: { hotel: HotelProfile }) {
  if (!hotel.url) return <span>{hotel.name}</span>;
  return (
    <a href={hotel.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline decoration-gold underline-offset-4 focus-ring">
      {hotel.name}
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: ReactNode }) {
  return (
    // A <dl> may only wrap each dt/dd pair in one plain <div>, so the icon sits in the <dt>.
    <div className="min-w-0">
      <dt className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="h-[18px] w-[18px] shrink-0 text-gold-text" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 pl-[30px] text-[14.5px] leading-relaxed text-foreground">{value}</dd>
    </div>
  );
}

type TripDetailClientProps = {
  slug: string;
  /**
   * The trip the server page already fetched. Seeding the query with it is what
   * puts the itinerary, price and departures into the initial HTML instead of
   * leaving a shell until the browser refetches.
   */
  initialTrip?: Trip;
  initialSiteSettings?: { tripNotice: string | null; bankDetails?: string | null };
};

/**
 * `useSearchParams()` must sit behind a `<Suspense>` boundary for this route
 * to be statically generated at all. The read lives in the one component that
 * needs it (the `?departure=` a shared link opens on), so everything else
 * renders straight from `initialTrip`.
 */
export default function TripDetailClient(props: TripDetailClientProps) {
  return (
    <Suspense fallback={<TripDetailClientInner {...props} selectedDate={undefined} />}>
      <TripDetailClientWithSearchParams {...props} />
    </Suspense>
  );
}

function TripDetailClientWithSearchParams(props: TripDetailClientProps) {
  // Read client-side, not as a page-level `searchParams` prop: a server
  // component that reads `searchParams` is forced fully dynamic by Next (no
  // ISR, no CDN caching) even though the trip data has nothing to do with it.
  const searchParams = useSearchParams();
  const rawDeparture = searchParams.get("departure");
  const selectedDate =
    rawDeparture && /^\d{4}-\d{2}-\d{2}$/.test(rawDeparture) ? rawDeparture : undefined;

  return <TripDetailClientInner {...props} selectedDate={selectedDate} />;
}

function TripDetailClientInner({
  slug,
  initialTrip,
  initialSiteSettings,
  selectedDate,
}: TripDetailClientProps & { selectedDate: string | undefined }) {
  const { data: trip, isLoading } = useTrip(slug, initialTrip);
  useLiveDepartures(slug, initialTrip);
  const { data: siteSettings } = useSiteSettings(initialSiteSettings);
  const { data: allTrips } = useTrips();

  const related = useMemo(() => {
    if (!trip || !allTrips) return [];
    const places = new Set(tripDestinations(trip).map((destination) => destination.key));
    const categoryIds = new Set([trip.categoryId, ...trip.categories.map((category) => category.id)].filter((id): id is string => Boolean(id)));
    const score = (candidate: Trip) =>
      tripDestinations(candidate).filter((destination) => places.has(destination.key)).length * 3 +
      [candidate.categoryId, ...candidate.categories.map((category) => category.id)].filter((id) => id && categoryIds.has(id)).length +
      (tripStatus(candidate).kind === "open" ? 1 : 0);
    return allTrips
      .filter((candidate) => candidate.id !== trip.id)
      .map((candidate) => ({ candidate, score: score(candidate) }))
      .filter((entry) => entry.score > 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((entry) => entry.candidate);
  }, [trip, allTrips]);

  const hotelProfiles = useMemo(
    () => trip ? hotelProfilesFromData(trip.sourceMetadata, trip.hotel, trip.hotelMedia) : [],
    [trip],
  );
  const travelerMedia = useMemo(() => parseMediaItems(trip?.travelerMedia) ?? [], [trip]);
  const siteNoticeLines = useMemo(() => noticeLines(siteSettings?.tripNotice), [siteSettings?.tripNotice]);
  const showBrochure = trip?.sourceMetadata?.hide_brochure_on_website !== true;
  // A clinic test list pasted into the description gets its own section; the
  // rest of the description stays "Аяллын тухай".
  const checkup = useMemo(() => {
    const description = trip?.description ?? "";
    const fromDescription = splitHealthCheckup(description);
    const notes = typeof trip?.sourceMetadata?.health_checkup_notes === "string" ? trip.sourceMetadata.health_checkup_notes : "";
    const lists = fromDescription.lists.length ? fromDescription.lists : splitHealthCheckup(notes).lists;
    return {
      about: fromDescription.lists.length ? fromDescription.intro : description,
      lists,
      fallbackText: lists.length ? "" : notes.trim(),
    };
  }, [trip?.description, trip?.sourceMetadata]);

  // One source of truth: the weather, the price table, the calendar and the
  // booking form all use this same departure.
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

  const conditionsShown = Boolean(
    trip && (siteNoticeLines.length > 0 || trip.importantNotes.length > 0 || trip.requirements || trip.cancellationPolicy || trip.departureRule || (showBrochure && (trip.brochurePdfUrl || chatbotPosterPdfUrl(trip.sourceTripId)))),
  );
  const stayShown = hotelProfiles.length > 0 || Boolean(trip?.hotel);

  const sections = useMemo<PageSection[]>(() => {
    if (!trip) return [];
    return [
      { id: "overview", label: "Тойм" },
      (checkup.lists.length > 0 || checkup.fallbackText) && { id: "checkup", label: "Шинжилгээ" },
      trip.itinerary.length > 0 && { id: "itinerary", label: "Хөтөлбөр" },
      { id: "prices", label: "Үнэ, огноо" },
      (trip.included.length > 0 || trip.excluded.length > 0) && { id: "included", label: "Багц" },
      stayShown && { id: "stay", label: "Буудал" },
      conditionsShown && { id: "conditions", label: "Нөхцөл" },
      hasWeather && { id: "weather", label: "Цаг агаар" },
      routeStops.length > 0 && { id: "route", label: "Маршрут" },
      trip.testimonials && trip.testimonials.length > 0 && { id: "reviews", label: "Сэтгэгдэл" },
    ].filter((entry): entry is PageSection => Boolean(entry));
  }, [trip, checkup, stayShown, conditionsShown, hasWeather, routeStops]);

  useEffect(() => {
    if (trip) recordRecentlyViewed(trip.slug);
  }, [trip]);

  if (isLoading) {
    return (
      <div className="site-container py-10" aria-busy="true">
        <div className="h-[420px] animate-pulse rounded-xl bg-sand" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="site-container py-24 text-center">
        <h1 className="display-2 text-foreground">Аялал олдсонгүй</h1>
        <Link href={canonicalPath("/trips")} className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground">
          Бүх аялал руу буцах
        </Link>
      </div>
    );
  }

  const title = formatTripTitle(trip.title);
  const places = tripDestinations(trip);
  const status = tripStatus(trip);
  const saleLabel = saleBadgeLabel(trip);
  const fromPrice = startingPrice(trip);
  const brochureUrl = showBrochure ? trip.brochurePdfUrl || chatbotPosterPdfUrl(trip.sourceTripId) : null;
  const categoryNames = [trip.category, ...trip.categories]
    .filter((category): category is NonNullable<typeof category> => Boolean(category))
    .filter((category, index, all) => all.findIndex((entry) => entry.id === category.id) === index);
  const primaryCategory = categoryNames[0];
  const travelers = trip.maxTravelers
    ? `${trip.minTravelers > 1 ? `${trip.minTravelers}–` : ""}${trip.maxTravelers} хүн`
    : trip.minTravelers > 1 ? `Хамгийн багадаа ${trip.minTravelers} хүн` : null;

  const sidebar = (
    <>
      <TripSidebar trip={trip} bankDetails={siteSettings?.bankDetails} selectedDate={activeDepartureDate} onDepartureChange={setChosenDepartureDate} />
      <div className="mt-4 grid grid-cols-2 gap-2" data-print="hide">
        <ChannelLink channelKey="phone" tripId={trip.id} from="trip-sidebar" className="flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-card text-[13px] font-semibold text-foreground focus-ring">
          Залгах
        </ChannelLink>
        <ChannelLink channelKey="messenger" tripId={trip.id} from="trip-sidebar" className="flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-card text-[13px] font-semibold text-foreground focus-ring">
          Messenger
        </ChannelLink>
      </div>
    </>
  );

  return (
    <article className="pb-10">
      <div className="site-container pt-6 lg:pt-8">
        <Breadcrumbs
          items={[
            { label: "Нүүр", href: canonicalPath("") },
            { label: "Аялалууд", href: canonicalPath("/trips") },
            ...(primaryCategory ? [{ label: formatCategoryName(primaryCategory.categoryName), href: categoryHref(primaryCategory.slug ?? primaryCategory.id) }] : []),
            { label: title },
          ]}
        />
        <div className="mt-5">
          <TripGallery trip={trip} />
        </div>

        <header className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {places.length > 0 && (
                <p className="eyebrow">
                  {[...new Set([...places.map((place) => place.label), ...places.map((place) => place.country)])].join(" · ")}
                </p>
              )}
              {saleLabel && <span className="rounded-full bg-destructive px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white">{saleLabel}</span>}
              {status.kind === "full" && <span className="rounded-full bg-navy-night px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white">Бүх огноо дүүрсэн</span>}
            </div>
            <h1 className={cn("mt-4 text-balance text-foreground", isAllCapsTitle(title) ? "display-2 tracking-[0.01em]" : "display-1")}>{title}</h1>
            {trip.summary && <p className="lede mt-4 max-w-3xl">{trip.summary}</p>}
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-[14px] text-foreground">
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gold-text" aria-hidden="true" />
                {trip.durationDays} өдөр{trip.durationNights ? ` · ${trip.durationNights} шөнө` : ""}
              </li>
              <li className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gold-text" aria-hidden="true" />
                {status.kind === "open"
                  ? <>Ойрын хөдлөлт: {formatDepartureDate(status.departure.startDate)}{status.openCount > 1 ? <span className="text-muted-foreground"> · +{status.openCount - 1} огноо</span> : null}</>
                  : status.kind === "full" ? "Бүх огноо дүүрсэн" : "Огноог ажилтнаас лавлана"}
              </li>
              {primaryCategory && (
                <li className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-gold-text" aria-hidden="true" />
                  {formatCategoryName(primaryCategory.categoryName)}
                </li>
              )}
              {trip.reviewCount > 0 && (
                <li className="flex items-center gap-2">
                  <Star className="h-4 w-4 fill-gold text-gold" aria-hidden="true" />
                  {trip.avgRating.toFixed(1)} ({trip.reviewCount})
                </li>
              )}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-2" data-print="hide">
            <SaveButton slug={trip.slug} variant="button" />
            <ShareButton title={title} tripId={trip.id} />
            {showBrochure && <DownloadTripButton />}
          </div>
        </header>
      </div>

      <div className="mt-10">
        <SectionNav sections={sections} />
      </div>

      <div className="site-container mt-10 grid gap-12 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_26.5rem]" data-trip-layout-grid>
        <div className="min-w-0 space-y-14 lg:space-y-16" data-trip-layout-main>
          <TripSection id="overview" eyebrow="Аяллын тойм" title="Энэ аялалд юу хүлээж байна">
            {checkup.about.trim() && <p className="whitespace-pre-line text-[16px] leading-[1.8] text-ink-soft">{checkup.about}</p>}
            {trip.highlights.length > 0 && (
              <ul className={cn("grid gap-3 sm:grid-cols-2", checkup.about.trim() && "mt-8")}>
                {trip.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-[14.5px] leading-snug text-foreground">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                    {highlight}
                  </li>
                ))}
              </ul>
            )}
            <dl className={cn("grid gap-6 rounded-xl border border-border bg-card p-6 sm:grid-cols-2", (checkup.about.trim() || trip.highlights.length > 0) && "mt-8")}>
              <Fact icon={Clock} label="Хугацаа" value={`${trip.durationDays} өдөр${trip.durationNights ? `, ${trip.durationNights} шөнө` : ""}`} />
              {places.length > 0 && <Fact icon={MapPin} label="Чиглэл" value={places.map((place) => (place.label === place.country ? place.label : `${place.label} (${place.country})`)).join(", ")} />}
              {categoryNames.length > 0 && <Fact icon={Compass} label="Аяллын төрөл" value={categoryNames.map((category) => formatCategoryName(category.categoryName)).join(", ")} />}
              {trip.foodIncluded !== null && <Fact icon={Utensils} label="Хоол" value={trip.foodIncluded ? "Хөтөлбөрт заасан хоол багтсан" : "Хоол багцад ороогүй"} />}
              {trip.transport.length > 0 && <Fact icon={Compass} label="Тээвэр" value={trip.transport.join(", ")} />}
              {trip.languages.length > 0 && <Fact icon={Languages} label="Хөтчийн хэл" value={trip.languages.join(", ")} />}
              {travelers && <Fact icon={Users} label="Бүлгийн хэмжээ" value={travelers} />}
              {DIFFICULTY_LABEL[trip.difficulty] && <Fact icon={Compass} label="Ачаалал" value={DIFFICULTY_LABEL[trip.difficulty]} />}
              {trip.meetingPoint && <Fact icon={MapPin} label="Цугларах цэг" value={trip.meetingPoint} />}
            </dl>
          </TripSection>

          <HealthCheckupSection lists={checkup.lists} fallbackText={checkup.fallbackText} />

          {trip.itinerary.length > 0 && (
            <TripSection id="itinerary" eyebrow={`${trip.itinerary.length} өдөр`} title="Өдөр тутмын хөтөлбөр">
              <ItineraryTimeline days={trip.itinerary} hotelLinks={hotelProfiles.filter((hotel) => hotel.url)} photoSource={trip} />
            </TripSection>
          )}

          <TripSection id="prices" eyebrow="Үнэ ба огноо" title="Хэзээ, хэдээр">
            <PricingSection
              trip={trip}
              activeDate={activeDepartureDate}
              onSelect={(date) => {
                setChosenDepartureDate(date);
                if (window.matchMedia("(max-width: 1023px)").matches) {
                  document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            />
          </TripSection>

          {/* The date picker and quote form are no use on paper; the price list above prints instead. */}
          <div id="booking" className="scroll-mt-36 lg:hidden print:hidden">
            <h2 className="sr-only">Захиалга</h2>
            {sidebar}
          </div>

          {(trip.included.length > 0 || trip.excluded.length > 0) && (
            <TripSection id="included" eyebrow="Багц" title="Үнэд юу багтсан бэ">
              <div className="grid gap-6 md:grid-cols-2">
                {trip.included.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="text-[15px] font-semibold text-foreground">Багцад багтсан</h3>
                    <ul className="mt-4 space-y-3">
                      {trip.included.map((item) => (
                        <li key={item} className="flex items-start gap-3 text-[14.5px] leading-snug text-foreground">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {trip.excluded.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="text-[15px] font-semibold text-foreground">Багцад ороогүй</h3>
                    <ul className="mt-4 space-y-3">
                      {trip.excluded.map((item) => (
                        <li key={item} className="flex items-start gap-3 text-[14.5px] leading-snug text-muted-foreground">
                          <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </TripSection>
          )}

          {stayShown && (
            <TripSection id="stay" eyebrow="Байрлах газар" title="Зочид буудал">
              <div className="space-y-4">
                {hotelProfiles.length > 0 ? hotelProfiles.map((hotel, index) => (
                  <article key={`${hotel.name}-${index}`} className="rounded-xl border border-border bg-card p-6">
                    <h3 className="flex items-start gap-2.5 text-[16px] text-foreground">
                      <BedDouble className="mt-0.5 h-5 w-5 shrink-0 text-gold-text" aria-hidden="true" />
                      <HotelNameLink hotel={hotel} />
                    </h3>
                    {hotel.description && <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-muted-foreground">{hotel.description}</p>}
                    {hotel.media.length > 0 && <div className="mt-4"><MediaGallery items={hotel.media} title={hotel.name} /></div>}
                  </article>
                )) : (
                  <p className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-6 text-[15px] leading-relaxed text-foreground">
                    <BedDouble className="mt-0.5 h-5 w-5 shrink-0 text-gold-text" aria-hidden="true" />
                    {trip.hotel}
                  </p>
                )}
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Буудлын нэрийг хөтөлбөрт бичигдсэнээр харууллаа. «Эсвэл адил зэрэглэлийн» гэж бичсэн бол эцсийн буудлыг захиалга баталгаажих үед ажилтан мэдэгдэнэ.
                </p>
              </div>
            </TripSection>
          )}

          {conditionsShown && (
            <TripSection id="conditions" eyebrow="Анхаарах зүйл" title="Нөхцөл ба бэлтгэл">
              <div className="space-y-5">
                {(siteNoticeLines.length > 0 || trip.importantNotes.length > 0) && (
                  <div className="rounded-xl border border-gold/50 bg-gold/10 p-6">
                    <h3 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                      <AlertCircle className="h-[18px] w-[18px] text-gold-text" aria-hidden="true" />
                      Чухал тэмдэглэл
                    </h3>
                    <ul className="mt-3 space-y-2 text-[14.5px] leading-relaxed text-foreground">
                      {/* The standing, site-wide note always comes first, then this trip's own notes. */}
                      {siteNoticeLines.map((note) => <li key={`site-${note}`}>{note}</li>)}
                      {trip.importantNotes.map((note) => <li key={note}>{note}</li>)}
                    </ul>
                  </div>
                )}
                <dl className="divide-y divide-border rounded-xl border border-border bg-card">
                  {trip.departureRule && (
                    <div className="p-6">
                      <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Хөдлөх өдрийн дүрэм</dt>
                      <dd className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-foreground">{trip.departureRule}</dd>
                    </div>
                  )}
                  {trip.requirements && (
                    <div className="p-6">
                      <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Шаардлага, бичиг баримт</dt>
                      <dd className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-foreground">{trip.requirements}</dd>
                    </div>
                  )}
                  <div className="p-6">
                    <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Цуцлалт, буцаалт</dt>
                    <dd className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-foreground">
                      {trip.cancellationPolicy || "Энэ аяллын цуцлалт, буцаалтын нөхцөлийг захиалга баталгаажих үед ажилтан тантай тохирно."}
                    </dd>
                  </div>
                </dl>
                {brochureUrl && (
                  <a href={brochureUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-[14px] font-semibold text-foreground focus-ring hover:border-foreground/35">
                    <FileDown className="h-4 w-4" aria-hidden="true" />
                    Хөтөлбөрийг PDF-ээр татах
                  </a>
                )}
              </div>
            </TripSection>
          )}

          {weather && hasWeather && (
            <TripSection id="weather" eyebrow="Цаг агаар" title="Аялах үеийн цаг агаар" className="print:hidden">
              <p className="-mt-2 mb-5 text-[14px] leading-relaxed text-muted-foreground">
                {weather.mode === "current"
                  ? "Очих хотуудын одоогийн цаг агаар — аялал ойртоход өдөр бүрийн мэдээ энд гарна."
                  : "Таны сонгосон огноонд, тухайн өдөр байх хотын цаг агаар."}
              </p>
              <TripWeather report={weather} onSelectDeparture={setChosenDepartureDate} />
            </TripSection>
          )}

          {routeStops.length > 0 && (
            <TripSection id="route" eyebrow="Маршрут" title="Аяллын зам" className="print:hidden">
              <RouteMap stops={routeStops} />
            </TripSection>
          )}

          {travelerMedia.length > 0 && (
            <TripSection id="traveler-media" eyebrow="Дурсамж" title="Аялагчдын зураг, бичлэг">
              <MediaGallery items={travelerMedia} title="Аялагчдын дурсамж" />
            </TripSection>
          )}

          {trip.mapUrl && (
            <section className="print:hidden" aria-label="Байршил">
              <div className="aspect-video overflow-hidden rounded-xl border border-border">
                <iframe src={trip.mapUrl} title={`${title} — байршил`} className="h-full w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            </section>
          )}

          {trip.testimonials && trip.testimonials.length > 0 && (
            <TripSection id="reviews" eyebrow="Сэтгэгдэл" title="Аялагчдын сэтгэгдэл">
              <div className="grid gap-4 sm:grid-cols-2">
                {trip.testimonials.map((testimonial) => (
                  <figure key={testimonial.id} className="rounded-xl border border-border bg-card p-6">
                    <div className="flex items-center gap-0.5" aria-label={`${testimonial.rating}/5`}>
                      {Array.from({ length: testimonial.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-gold text-gold" aria-hidden="true" />)}
                    </div>
                    <blockquote className="mt-3 text-[14.5px] leading-relaxed text-foreground">{testimonial.comment}</blockquote>
                    <figcaption className="mt-3 text-[13px] font-semibold text-muted-foreground">{testimonial.authorName}</figcaption>
                  </figure>
                ))}
              </div>
            </TripSection>
          )}

          <PhotoCredits trip={trip} />
        </div>

        <aside className="hidden lg:block" aria-label="Захиалга">
          <StickyHandoffSidebar topOffset={148} bottomGap={20}>
            {sidebar}
          </StickyHandoffSidebar>
        </aside>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="site-container mt-20 border-t border-border pt-16" data-print="hide">
          <p className="eyebrow">Төстэй аялал</p>
          <h2 id="related-title" className="display-2 mt-3 text-foreground">Эдгээр аялал ч таалагдаж магадгүй</h2>
          <ul className="mt-10 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6">
            {related.map((candidate) => (
              <li key={candidate.id}>
                <TripCard trip={candidate} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <MobileTripBar
        tripId={trip.id}
        tripSlug={trip.slug}
        price={hasKnownTripPrice(fromPrice) ? fromPrice : null}
        priceLabel={status.kind === "full" ? "Бүх огноо дүүрсэн" : "-с эхлэн · нэг том хүн"}
        status={status.kind}
      />
    </article>
  );
}
