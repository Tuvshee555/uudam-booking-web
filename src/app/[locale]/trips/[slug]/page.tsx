import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import JsonLd from "@/components/content/JsonLd";
import TripMedia from "@/components/trip/TripMedia";
import { prisma } from "@/server/prisma";
import { TRIP_INCLUDE } from "@/server/tripInput";
import { getSiteSettings as getSiteSettingsUncached } from "@/server/catalog";
import { formatTripStartingPrice, hasKnownTripPrice } from "@/lib/pricing";
import { shareMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/siteUrl";
import { tripMetaDescription } from "@/lib/tripSeo";
import { publicTrip } from "@/lib/publicTrip";
import { formatTripTitle } from "@/lib/tripDisplay";
import type { Trip } from "@/types/trip";
import TripDetailClient from "./TripDetailClient";

type Props = { params: Promise<{ slug: string }> };

/**
 * The missing piece that made every other fix on this page a no-op: Next
 * only adds a dynamic segment to its prerender manifest — the thing that
 * makes ANY caching (revalidate export, unstable_cache, ISR) apply to a
 * route at all — when `generateStaticParams` is defined for it, even if it
 * returns nothing. Confirmed directly against `.next/prerender-manifest.json`:
 * every OTHER route on this site (home, trips list, category, discover,
 * guide — none of which define their own generateStaticParams, because
 * their only dynamic segment is `[locale]`, satisfied by the layout's) was
 * present under `dynamicRoutes`; `/[locale]/trips/[slug]` was not present
 * AT ALL. Every response carried `Cache-Control: no-store` regardless of
 * the revalidate export below or the unstable_cache wraps further down —
 * there was no prerender entry for the runtime to populate.
 *
 * ~30 published trips, so pre-rendering all of them at build time (rather
 * than an empty array + first-visitor-pays-the-render-cost) means no
 * visitor ever hits an uncached render for an existing trip.
 */
export async function generateStaticParams() {
  const trips = await prisma.trip.findMany({
    where: { OR: [{ isPublished: true }, { sourceMetadata: { path: ["publicInfoOnly"], equals: true } }] },
    select: { slug: true },
  });
  return trips.map((trip) => ({ slug: trip.slug }));
}

/**
 * No `revalidate` export used to mean "cached until a save revalidates it",
 * which is what you want — except this page ALSO read `searchParams` (the
 * `?departure=` that pre-selects a date), and a server component that reads
 * searchParams is forced fully dynamic by Next regardless of any other
 * setting: no ISR, no edge caching, `Cache-Control: no-store` on every
 * response. That `?departure=` read has moved to the client component
 * (useSearchParams, which doesn't affect server caching) specifically so
 * this page can be a normal cached page again. Saving a trip revalidates
 * this path immediately (see revalidateTripPages in /api/trips/[id]), so
 * this is a safety net, matching the other catalogue pages.
 */
export const revalidate = 300;

/**
 * Server-only lookup. Two jobs, which is why it fetches the whole trip rather
 * than a handful of columns:
 *
 * 1. A shared trip link lands in Facebook Messenger — the agency's actual sales
 *    channel — so the preview card needs this trip's own title, price and photo.
 * 2. The full record is handed to the client component as `initialData`, so the
 *    itinerary, departures, inclusions and price render in the *initial HTML*.
 *    Previously only the slug was passed down and the browser refetched
 *    everything, which left crawlers a page whose only headings were the
 *    footer's.
 *
 * Wrapped in BOTH caches, for two different jobs:
 * - `unstable_cache` is what actually persists the result ACROSS requests and
 *   visitors. Without it, `export const revalidate` above does nothing at
 *   all: Next's route cache only knows how to cache `fetch()` calls (or
 *   `unstable_cache`-wrapped ones) discovered during render — a plain
 *   Prisma query is invisible to it, and since this route has no
 *   `generateStaticParams` either (so there's no pre-built HTML to serve as
 *   the cached artifact), every request rendered from scratch regardless of
 *   the revalidate export. Confirmed live: every response carried
 *   `Cache-Control: no-store` and `X-Vercel-Cache: MISS`, even on repeat
 *   requests for the identical slug, until this wrap was added.
 * - `cache` (React) still dedupes the query WITHIN a single request, so
 *   `generateMetadata` and the page body (separate invocations) share one
 *   call instead of two.
 *
 * `revalidatePath` on a trip save (see revalidateTripPages in
 * /api/trips/[id]) invalidates this the same as a `fetch`-based cache would.
 */
const findPublishedTrip = cache(
  unstable_cache(
    async (slug: string) => {
      return prisma.trip.findFirst({
        where: { slug, OR: [{ isPublished: true }, { sourceMetadata: { path: ["publicInfoOnly"], equals: true } }] },
        include: {
          ...TRIP_INCLUDE,
          testimonials: {
            where: { isPublished: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });
    },
    ["trip-detail"],
    { revalidate: 300 },
  ),
);

/** Same gap, same fix, for the shared site settings (trip notice / bank details) this page also reads. */
const getSiteSettings = unstable_cache(getSiteSettingsUncached, ["trip-detail-site-settings"], {
  revalidate: 300,
});

/**
 * Match what `/api/trips/[id]` puts on the wire, so the hydrated cache entry is
 * byte-identical to what a later refetch would return: `NextResponse.json`
 * serialises Dates to ISO strings, and the client `Trip` type expects strings.
 */
function serializeTrip(trip: NonNullable<Awaited<ReturnType<typeof findPublishedTrip>>>): Trip {
  return JSON.parse(JSON.stringify(publicTrip(trip))) as Trip;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const trip = await findPublishedTrip(slug);

  if (!trip) {
    return { title: "Аялал олдсонгүй" };
  }

  const description = tripMetaDescription(trip);

  const displayTitle = formatTripTitle(trip.title);
  if (!trip.isPublished) {
    return {
      title: `${displayTitle} — Хөтөлбөрийн танилцуулга`,
      description: "Аяллын хөтөлбөрийн танилцуулга. Шинэ гарах өдөр, үнэ баталгаажаагүй.",
      robots: { index: false, follow: false },
    };
  }
  const title = `${displayTitle} — ${formatTripStartingPrice(trip.price)}`;
  const photo = trip.image ? { url: trip.image, width: 1200, height: 630, alt: displayTitle } : undefined;

  return { title, description, ...shareMetadata(`/trips/${slug}`, title, description, photo) };
}

export default async function TripDetailPage({ params }: Props) {
  const { slug } = await params;
  const [trip, siteSettings] = await Promise.all([findPublishedTrip(slug), getSiteSettings()]);

  // A shared link to a trip that's since been unpublished or deleted should
  // 404 for real (search engines, unfurl bots), not render a 200 page whose
  // content happens to say "not found" — that was a soft-404.
  if (!trip) notFound();
  if (!trip.isPublished) {
    const preview = serializeTrip(trip);
    const days = trip.itinerary.filter((day) => day.dayNumber > 0).sort((a, b) => a.dayNumber - b.dayNumber);
    return (
      <main className="uudam-container py-8 pb-16">
        <Link href="/mn/trips" className="text-sm text-primary underline">← Аялалууд руу буцах</Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Хөтөлбөрийн танилцуулга</p>
              <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">{formatTripTitle(trip.title)}</h1>
              {trip.description && <p className="mt-3 text-lg text-muted-foreground">{trip.description}</p>}
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                {trip.city && <span className="rounded-full bg-secondary px-3 py-1">{trip.city}, {trip.country}</span>}
                {days.length > 0 && <span className="rounded-full bg-secondary px-3 py-1">{days.length} өдрийн хөтөлбөр</span>}
              </div>
            </div>
            <TripMedia trip={preview} />
            <p className="mt-3 text-xs text-muted-foreground">Зургууд нь аяллын чиглэлийн жишиг дүрслэл; зочид буудлын баталгаат зураг биш.</p>

            <section className="mt-10">
              <h2 className="text-2xl font-semibold">Өдөр бүрийн хөтөлбөр</h2>
              <div className="mt-5 space-y-4">
                {days.map((day) => (
                  <article key={day.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-start gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{day.dayNumber}</span>
                      <div>
                        <h3 className="text-lg font-semibold">{day.title}</h3>
                        {day.description && <p className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">{day.description}</p>}
                        {day.meals.length > 0 && <p className="mt-3 text-sm text-muted-foreground">Хоол: {day.meals.join(", ")}</p>}
                        {day.accommodation && <p className="mt-1 text-sm text-muted-foreground">Буудал: {day.accommodation}</p>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            {(trip.included.length > 0 || trip.excluded.length > 0) && (
              <section className="mt-10 grid gap-5 md:grid-cols-2">
                {trip.included.length > 0 && <div className="rounded-2xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">Үнэд багтсан</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">{trip.included.map((item) => <li key={item}>{item}</li>)}</ul></div>}
                {trip.excluded.length > 0 && <div className="rounded-2xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">Үнэд багтаагүй</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">{trip.excluded.map((item) => <li key={item}>{item}</li>)}</ul></div>}
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-sm">
              <p className="text-lg font-bold">Одоогоор захиалга авахгүй</p>
              <p className="mt-2 text-sm leading-relaxed">Шинэ гарах өдөр, үнэ, хүүхэд болон нярайн үнэ, суудлын мэдээлэл баталгаажаагүй. Доорх нь өмнөх хөтөлбөрийн танилцуулга юм.</p>
              <Link href="/mn/contact" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:opacity-90">Шинэ аяллын талаар лавлах</Link>
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold">Хөтөлбөрийн мэдээлэл</h2>
              {trip.hotel && <p className="mt-3 text-sm text-muted-foreground">Буудал: {trip.hotel}</p>}
              <p className="mt-2 text-sm text-muted-foreground">Буудлын нэр, өрөөний ангилал болон шинэ үнийг баталгаажуулах шаардлагатай.</p>
              {trip.brochurePdfUrl && <a href={trip.brochurePdfUrl} className="mt-4 inline-block text-sm font-semibold text-primary underline">Эх PDF хөтөлбөрийг үзэх ↗</a>}
            </div>
          </aside>
        </div>
      </main>
    );
  }
  const visibleDepartures = trip.departures.filter(
    (departure) =>
      departure.status !== "CANCELLED" &&
      departure.status !== "DEPARTED",
  );
  const allUpcomingSoldOut =
    visibleDepartures.length > 0 &&
    visibleDepartures.every(
      (departure) =>
        departure.status === "SOLD_OUT" ||
        (typeof departure.seatsLeft === "number" && departure.seatsLeft <= 0),
    );

  const jsonLd = trip && {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: formatTripTitle(trip.title),
    description: tripMetaDescription(trip),
    image: trip.image || undefined,
    url: `${SITE_URL}/mn/trips/${slug}`,
    touristType: trip.country ? `${[trip.city, trip.country].filter(Boolean).join(", ")}` : undefined,
    itinerary: { "@type": "ItemList", numberOfItems: trip.durationDays },
    offers: hasKnownTripPrice(trip.price)
      ? {
          "@type": "Offer",
          price: trip.price,
          priceCurrency: trip.currency,
          availability: allUpcomingSoldOut
            ? "https://schema.org/SoldOut"
            : "https://schema.org/InStock",
          url: `${SITE_URL}/mn/trips/${slug}`,
        }
      : undefined,
    ...(trip.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: trip.avgRating,
            reviewCount: trip.reviewCount,
          },
        }
      : {}),
  };

  return (
    <>
      {jsonLd && <JsonLd id={`trip-json-ld-${slug}`} data={jsonLd} />}
      <TripDetailClient
        slug={slug}
        initialTrip={serializeTrip(trip)}
        initialSiteSettings={siteSettings}
      />
    </>
  );
}
