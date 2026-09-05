import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/server/prisma";
import { TRIP_INCLUDE } from "@/server/tripInput";
import { getSiteSettings } from "@/server/catalog";
import { formatTripStartingPrice, hasKnownTripPrice } from "@/lib/pricing";
import { localeAlternates } from "@/lib/hreflang";
import type { Trip } from "@/types/trip";
import TripDetailClient from "./TripDetailClient";

type Props = { params: Promise<{ slug: string }> };

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
 * `cache` dedupes the query across `generateMetadata` and the page render,
 * which are separate invocations within the same request.
 */
const findPublishedTrip = cache(async (slug: string) => {
  return prisma.trip.findFirst({
    where: { slug, isPublished: true },
    include: {
      ...TRIP_INCLUDE,
      testimonials: {
        where: { isPublished: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
});

/**
 * Match what `/api/trips/[id]` puts on the wire, so the hydrated cache entry is
 * byte-identical to what a later refetch would return: `NextResponse.json`
 * serialises Dates to ISO strings, and the client `Trip` type expects strings.
 */
function serializeTrip(trip: NonNullable<Awaited<ReturnType<typeof findPublishedTrip>>>): Trip {
  return JSON.parse(JSON.stringify(trip)) as Trip;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://uudamtravel.mn";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const trip = await findPublishedTrip(slug);

  if (!trip) {
    return { title: "Аялал олдсонгүй" };
  }

  const description =
    trip.summary?.trim() || trip.description.slice(0, 160).trim() || undefined;

  const title = `${trip.title} — ${formatTripStartingPrice(trip.price)}`;
  const previewImages = trip.image ? [{ url: trip.image, width: 1200, height: 630, alt: trip.title }] : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: previewImages,
    },
    twitter: {
      card: previewImages ? "summary_large_image" : "summary",
      title,
      description,
      images: trip.image ? [trip.image] : undefined,
    },
    alternates: { languages: localeAlternates(`/trips/${slug}`) },
  };
}

export default async function TripDetailPage({ params }: Props) {
  const { slug } = await params;
  const [trip, siteSettings] = await Promise.all([findPublishedTrip(slug), getSiteSettings()]);

  // A shared link to a trip that's since been unpublished or deleted should
  // 404 for real (search engines, unfurl bots), not render a 200 page whose
  // content happens to say "not found" — that was a soft-404.
  if (!trip) notFound();

  const jsonLd = trip && {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: trip.title,
    description: trip.summary?.trim() || trip.description.slice(0, 300).trim(),
    image: trip.image || undefined,
    url: `${SITE_URL}/trips/${slug}`,
    touristType: trip.country ? `${[trip.city, trip.country].filter(Boolean).join(", ")}` : undefined,
    itinerary: { "@type": "ItemList", numberOfItems: trip.durationDays },
    offers: hasKnownTripPrice(trip.price)
      ? {
          "@type": "Offer",
          price: trip.price,
          priceCurrency: trip.currency,
          availability: "https://schema.org/InStock",
          url: `${SITE_URL}/trips/${slug}`,
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
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <TripDetailClient
        slug={slug}
        initialTrip={serializeTrip(trip)}
        initialSiteSettings={siteSettings}
      />
    </>
  );
}
