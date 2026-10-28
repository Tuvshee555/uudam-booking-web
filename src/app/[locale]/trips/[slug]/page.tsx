import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import JsonLd from "@/components/content/JsonLd";
import InformationOnlyTrip from "@/components/trip/InformationOnlyTrip";
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
    return <InformationOnlyTrip trip={serializeTrip(trip)} sourceMetadata={trip.sourceMetadata} />;
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
