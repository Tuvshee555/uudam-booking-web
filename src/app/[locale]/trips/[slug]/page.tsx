import type { Metadata } from "next";

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
      country: true,
      city: true,
    },
  });
}

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
  return <TripDetailClient slug={slug} />;
}
