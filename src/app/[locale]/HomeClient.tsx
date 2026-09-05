"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Compass, Headphones, ImageOff, PhoneCall, Sparkles } from "lucide-react";

import { useTrips, useCategoryTree } from "@/hooks/useTrips";
import type { CategoryNode, Trip } from "@/types/trip";
import { availability, upcomingDepartures } from "@/lib/departures";
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
      className="object-cover transition-transform duration-500 group-hover:scale-105"
      onError={() => setFailed(true)}
    />
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

          return (
            <Link
              key={`${trip.id}:${departure.id}`}
              href={`${base}/trips/${trip.slug}`}
              className="flex items-center gap-3 rounded-2xl border border-border p-3.5 transition-colors hover:border-primary/40 hover:bg-secondary/40"
            >
              <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-secondary py-2">
                <span className="text-lg font-bold leading-none">
                  {new Date(departure.startDate).getDate()}
                </span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">
                  {new Date(departure.startDate).toLocaleDateString("mn-MN", { month: "short" })}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{trip.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {trip.durationDays} хоног · {seats.label}
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
function CustomTripCta({ base }: { base: string }) {
  return (
    <section className="uudam-container py-14">
      <div className="rounded-3xl border border-border bg-secondary/40 p-8 text-center sm:p-12">
        <h2 className="text-2xl font-bold md:text-3xl">Огноо тохирохгүй байна уу?</h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Гэр бүл, найз нөхөд, хамт олондоо зориулж өөрийн огноогоор аялал зохион байгуулж
          өгнө. Хүссэн чиглэлээ хэлэхэд ажилтан хөтөлбөр, үнийн санал бэлдэнэ.
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
}) {
  const { locale } = useI18n();
  const base = `/${locale}`;
  const { data: categories } = useCategoryTree(initialCategories);

  return (
    <div>
      {/* Hero — white-first: a real photo carries the atmosphere, navy and
          gold only touch type and the two buttons. */}
      <section className="relative overflow-hidden bg-background">
        <div className="uudam-container grid gap-10 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="relative z-10 max-w-2xl">
            <span className="uudam-eyebrow">Uudam Travel Agency</span>
            <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-foreground md:text-5xl lg:text-6xl">
              Дараагийн аялалаа
              <span className="block text-primary">эндээс эхлүүл</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Хөтөлбөр, үнэ, хөдлөх огноо, үлдсэн суудал — бүгд ил тод. Хүссэн аялалаа
              сонгоод шууд захиал.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={`${base}/trips`}>
                  Аялал үзэх
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={`${base}/contact`}>Зөвлөгөө авах</Link>
              </Button>
            </div>
          </div>

          <div className="relative hidden aspect-[4/3] overflow-hidden rounded-3xl shadow-xl shadow-primary/10 lg:block">
            <Image
              src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1400&q=80"
              alt=""
              fill
              sizes="45vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/30 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Шинэ аялалууд долоо бүр нэмэгдэнэ
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-border bg-secondary/30">
        <div className="uudam-container grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Compass, title: "Мэргэжлийн хөтөч", text: "Туршлагатай хөтөч дагалдана" },
            { icon: PhoneCall, title: "Ажилтантай шууд", text: "Утсаар холбогдож баталгаажуулна" },
            { icon: Sparkles, title: "Ил тод үнэ", text: "Нуугдмал төлбөргүй" },
            { icon: Headphones, title: "24/7 тусламж", text: "Аяллын турш холбоотой" },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-xs text-muted-foreground">{text}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {trustBar}

      {/* Categories */}
      {categories && categories.length > 0 && (
        <section className="uudam-container py-14">
          <h2 className="text-2xl font-bold md:text-3xl">Чиглэлээр нь сонгох</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.slice(0, 8).map((category) => (
              <Link
                key={category.id}
                href={`${base}/category/${category.slug ?? category.id}`}
                className="group relative aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-secondary"
              >
                <CategoryThumb src={category.image} alt={category.categoryName} />
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

      <CustomTripCta base={base} />
    </div>
  );
}
