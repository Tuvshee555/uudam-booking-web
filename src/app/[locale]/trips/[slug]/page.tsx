import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/server/prisma";
import { formatMnt } from "@/lib/pricing";
import TripDetailClient from "./TripDetailClient";

type Props = { params: Promise<{ slug: string }> };

/**
 * Server-only lookup, kept separate from the client hook: a shared trip link
 * lands in Facebook Messenger — the agency's actual sales channel — so the
 * preview card needs this trip's own title, price and photo, not the generic
 * site-wide description every page used to fall back to.
 */
async function findPublishedTrip(slug: string) {
  return prisma.trip.findFirst({
    where: { slug, isPublished: true },
    select: {
      title: true,
      summary: true,
      description: true,
      image: true,
      price: true,
      currency: true,
      durationDays: true,
      country: true,
      city: true,
      avgRating: true,
      reviewCount: true,
    },
  });
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

  const title = `${trip.title} — ${formatMnt(trip.price)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: trip.image, width: 1200, height: 630, alt: trip.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [trip.image],
    },
  };
}

export default async function TripDetailPage({ params }: Props) {
  const { slug } = await params;
  const trip = await findPublishedTrip(slug);

  // A shared link to a trip that's since been unpublished or deleted should
  // 404 for real (search engines, unfurl bots), not render a 200 page whose
  // content happens to say "not found" — that was a soft-404.
  if (!trip) notFound();

  const jsonLd = trip && {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: trip.title,
    description: trip.summary?.trim() || trip.description.slice(0, 300).trim(),
    image: trip.image,
    url: `${SITE_URL}/trips/${slug}`,
    touristType: trip.country ? `${[trip.city, trip.country].filter(Boolean).join(", ")}` : undefined,
    itinerary: { "@type": "ItemList", numberOfItems: trip.durationDays },
    offers: {
      "@type": "Offer",
      price: trip.price,
      priceCurrency: trip.currency,
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/trips/${slug}`,
    },
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
      <TripDetailClient slug={slug} />
    </>
  );
}
