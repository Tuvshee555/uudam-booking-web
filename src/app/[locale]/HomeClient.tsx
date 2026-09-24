"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ImageOff,
} from "lucide-react";

import { useTrips, useCategoryTree } from "@/hooks/useTrips";
import type { CategoryNode, Trip } from "@/types/trip";
import { availability, formatMonthShort, upcomingDepartures } from "@/lib/departures";
import { departureSeatFact } from "@/lib/tripMarketing";
import { formatTripTitle } from "@/lib/tripDisplay";
import {
  DEFAULT_HOME_CUSTOM_CTA_BODY,
  DEFAULT_HOME_CUSTOM_CTA_TITLE,
  DEFAULT_HOME_HERO_SUBTITLE,
  DEFAULT_HOME_HERO_TITLE,
  DEFAULT_HOME_HERO_TITLE_ACCENT,
} from "@/lib/siteContent";
import TripCard from "@/components/trip/TripCard";
import RecentlyViewedStrip from "@/components/trip/RecentlyViewedStrip";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { Button } from "@/components/ui/button";

/** Falls back to a plain icon tile instead of a broken-image glyph when a
    category has no photo, or the stored URL no longer resolves. */
function CategoryThumb({ src, alt }: { src: string | null | undefined; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-secondary">
        <ImageOff className="h-6 w-6 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 640px) 100vw, 25vw"
      quality={90}
      className="uudam-photo-drift object-cover transition-transform duration-700 group-hover:scale-110"
      onError={() => setFailed(true)}
    />
  );
}

const CURATED_HERO_IMAGES = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=90",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2400&q=90",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=2400&q=90",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=2400&q=90",
  "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=2400&q=90",
];

function HeroSlideshow() {
  // Keep the homepage hero visually consistent even when a trip has a small
  // or compressed upload. Trip photos still appear on the catalogue cards.
  const images = CURATED_HERO_IMAGES;

  const [active, setActive] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % images.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [images.length]);

  const goToPrevious = () => {
    setActive((current) => (current - 1 + images.length) % images.length);
  };

  const goToNext = () => {
    setActive((current) => (current + 1) % images.length);
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      {images.map((src, index) => (
        <Image
          key={`${src}-${index}`}
          src={src}
          alt=""
          fill
          sizes="100vw"
          className={
            "object-cover transition-opacity duration-[1600ms] " +
            (index === active ? "opacity-100 uudam-hero-kenburns" : "opacity-0")
          }
          quality={90}
          priority={index === 0}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-navy-deep/80 via-navy-deep/30 to-navy-deep/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/55 via-transparent to-black/10" />

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={goToPrevious}
            className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/20 text-white shadow-lg backdrop-blur transition hover:bg-white hover:text-navy-deep md:flex"
            aria-label="Өмнөх зураг"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={goToNext}
            className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/20 text-white shadow-lg backdrop-blur transition hover:bg-white hover:text-navy-deep md:flex"
            aria-label="Дараагийн зураг"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div className="absolute bottom-5 right-4 z-20 hidden items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-navy-deep shadow-sm backdrop-blur sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
        Шинэ аялалууд долоо бүр нэмэгдэнэ
      </div>

      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        {images.map((src, index) => (
          <button
            key={`${src}-dot-${index}`}
            type="button"
            onClick={() => setActive(index)}
            className={
              "h-2 rounded-full transition-all " +
              (index === active ? "w-8 bg-white" : "w-2 bg-white/55 hover:bg-white")
            }
            aria-label={`${index + 1}-р зураг`}
          />
        ))}
      </div>
    </div>
  );
}

function TripGrid({ featured, initialTrips }: { featured?: boolean; initialTrips?: Trip[] }) {
  // `useTrips` keys by params, so the featured grid is a separate cache entry
  // and must be seeded with the featured subset rather than the whole list.
  const { data, isLoading } = useTrips(
    featured ? { featured: true } : undefined,
    featured ? initialTrips?.filter((trip) => trip.isFeatured) : initialTrips,
  );

  if (isLoading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[380px] animate-pulse rounded-2xl bg-secondary" />
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        Одоогоор нийтлэгдсэн аялал алга байна.
      </p>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {data.slice(0, 8).map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  );
}

/**
 * Next departures across the whole catalogue.
 *
 * Mongolian group-tour buyers usually start from "when can I get away?" rather
 * than a destination, which is why Mongolayalal keeps a calendar in its primary
 * nav. This is the homepage entry point to the same question.
 */
function DepartingSoon({ trips, base }: { trips: Trip[]; base: string }) {
  const [now] = useState(() => Date.now());

  const soon = useMemo(() => {
    const rows = trips.flatMap((trip) =>
      upcomingDepartures(trip, now).map((departure) => ({ trip, departure })),
    );

    rows.sort(
      (a, b) =>
        new Date(a.departure.startDate).getTime() - new Date(b.departure.startDate).getTime(),
    );

    return rows.slice(0, 6);
  }, [trips, now]);

  if (soon.length === 0) return null;

  return (
    <section className="uudam-container py-14">
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="uudam-eyebrow text-primary">Ойрын хугацаанд</span>
          <h2 className="mt-1 text-2xl font-bold md:text-3xl">Удахгүй хөдлөх аялалууд</h2>
        </div>
        <Link
          href={`${base}/departures`}
          className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:flex"
        >
          Бүх хуваарь
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {soon.map(({ trip, departure }) => {
          const seats = availability(departure);
          const exactSeats = departureSeatFact(departure);

          return (
            <Link
              key={`${trip.id}:${departure.id}`}
              href={`${base}/trips/${trip.slug}`}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-border p-3.5 transition-colors hover:border-primary/40 hover:bg-secondary/40"
            >
              <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-secondary py-2">
                <span className="text-lg font-bold leading-none">
                  {new Date(departure.startDate).getDate()}
                </span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatMonthShort(departure.startDate)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{formatTripTitle(trip.title)}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {trip.durationDays} хоног ·{" "}
                  <span className={seats.tone === "closed" ? "font-semibold text-destructive" : ""}>
                    {seats.label}
                  </span>
                  {exactSeats && exactSeats !== seats.label && ` · ${exactSeats}`}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <Link
        href={`${base}/departures`}
        className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline sm:hidden"
      >
        Бүх хуваарь
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

/**
 * Every catalogue trip can miss a visitor's dates, and 11 of them have no
 * published departure at all — so the homepage needs a route for the person
 * whose schedule fits nothing on offer.
 */
function CustomTripCta({
  base,
  title,
  body,
}: {
  base: string;
  title: string;
  body: string;
}) {
  return (
    <section className="uudam-container py-14">
      <div className="rounded-3xl border border-border bg-secondary/40 p-8 text-center sm:p-12">
        <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          {body}
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href={`${base}/custom-trip`}>Захиалгат аялал хүсэх</Link>
        </Button>
      </div>
    </section>
  );
}

export default function HomeClient({
  initialTrips,
  initialCategories,
  trustBar,
  reviewsSection,
  heroTitle,
  heroTitleAccent,
  heroSubtitle,
  customCtaTitle,
  customCtaBody,
}: {
  initialTrips?: Trip[];
  initialCategories?: CategoryNode[];
  /**
   * Rendered server-side in page.tsx and passed down as a slot: it reads
   * Prisma directly for a live trip count, which an async Server Component
   * can do but this Client Component cannot.
   */
  trustBar?: ReactNode;
  /** Same reasoning as trustBar — reads Testimonial rows server-side. */
  reviewsSection?: ReactNode;
  /** Admin-editable copy from SiteSettings — null/undefined falls back to
      the original hardcoded strings, same pattern as the about page. */
  heroTitle?: string | null;
  heroTitleAccent?: string | null;
  heroSubtitle?: string | null;
  customCtaTitle?: string | null;
  customCtaBody?: string | null;
}) {
  const { locale } = useI18n();
  const base = `/${locale}`;
  const { data: categories } = useCategoryTree(initialCategories);
  const visibleCategories = categories?.filter((category) => category.tripCount > 0) ?? [];
  const featuredTrips = initialTrips?.filter((trip) => trip.isFeatured) ?? [];

  return (
    <div>
      <section className="relative isolate flex min-h-[430px] overflow-hidden bg-navy-deep text-white md:min-h-[500px] lg:min-h-[540px]">
        <HeroSlideshow />

        <div className="uudam-container relative z-10 flex min-h-[430px] items-center py-14 md:min-h-[500px] lg:min-h-[540px]">
          <div className="max-w-3xl">
            <span className="uudam-eyebrow">Uudam Travel Agency</span>
            <h1 className="mt-3 max-w-2xl text-5xl font-bold leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
              {heroTitle || DEFAULT_HOME_HERO_TITLE}
              <span className="block text-gold">{heroTitleAccent || DEFAULT_HOME_HERO_TITLE_ACCENT}</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
              {heroSubtitle || DEFAULT_HOME_HERO_SUBTITLE}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-white text-navy-deep hover:bg-white/90">
                <Link href={`${base}/trips`}>
                  Аялал үзэх
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/45 bg-white/10 text-white backdrop-blur hover:bg-white hover:text-navy-deep"
              >
                <Link href={`${base}/contact`}>Зөвлөгөө авах</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {trustBar}

      {/* Categories */}
      {visibleCategories.length > 0 && (
        <section className="uudam-container py-14">
          <h2 className="text-2xl font-bold md:text-3xl">Чиглэлээр нь сонгох</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visibleCategories.slice(0, 8).map((category) => (
              <Link
                key={category.id}
                href={`${base}/category/${category.slug ?? category.id}`}
                className="group relative aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-secondary"
              >
                <CategoryThumb
                  src={initialTrips?.find((trip) => trip.categoryId === category.id && trip.image)?.image ?? category.image}
                  alt={category.categoryName}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="text-base font-semibold text-white">{category.categoryName}</div>
                  <div className="text-xs text-white/70">{category.tripCount} аялал</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {initialTrips && initialTrips.length > 0 && (
        <DepartingSoon trips={initialTrips} base={base} />
      )}

      <RecentlyViewedStrip />

      {/* Featured */}
      {featuredTrips.length > 0 && (
        <section className="uudam-container pb-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="uudam-eyebrow text-primary">Онцлох</span>
              <h2 className="mt-1 text-2xl font-bold md:text-3xl">Хамгийн эрэлттэй аялалууд</h2>
            </div>
            <Link
              href={`${base}/trips`}
              className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:flex"
            >
              Бүгдийг үзэх
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6">
            <TripGrid featured initialTrips={initialTrips} />
          </div>
        </section>
      )}

      {/* All trips */}
      <section className="uudam-container py-14">
        <h2 className="text-2xl font-bold md:text-3xl">Шинэ аялалууд</h2>
        <div className="mt-6">
          <TripGrid initialTrips={initialTrips} />
        </div>

        <div className="mt-8 text-center">
          <Button asChild variant="outline" size="lg">
            <Link href={`${base}/trips`}>
              Бүх аяллыг үзэх
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {reviewsSection}

      <CustomTripCta
        base={base}
        title={customCtaTitle || DEFAULT_HOME_CUSTOM_CTA_TITLE}
        body={customCtaBody || DEFAULT_HOME_CUSTOM_CTA_BODY}
      />
    </div>
  );
}
