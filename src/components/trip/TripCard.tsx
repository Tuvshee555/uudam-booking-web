"use client";

import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Clock, MapPin, Play, Star } from "lucide-react";

import type { Trip } from "@/types/trip";
import { formatMnt, formatTripStartingPrice, hasKnownTripPrice } from "@/lib/pricing";
import { formatDepartureDate, nextBookableDeparture, nextDeparture, startingPrice } from "@/lib/departures";
import { isSoldOutDeparture, saleBadgeLabel } from "@/lib/tripMarketing";
import SaveButton from "@/components/trip/SaveButton";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { formatTripTitle } from "@/lib/tripDisplay";

/**
 * `eager` marks a card visible without scrolling (the first grid row), so its
 * photo loads with the page instead of popping in as a gray tile. Below `sm`
 * the card renders compact — two to a row — keeping the phone catalog to a
 * few screens instead of one card per screen.
 */
export default function TripCard({ trip, eager = false }: { trip: Trip; eager?: boolean }) {
  const { locale } = useI18n();
  const departure = nextBookableDeparture(trip) ?? nextDeparture(trip);
  const price = startingPrice(trip);
  const hasVideo = Boolean(trip.video) || trip.videos.length > 0;

  // Seat wording is deliberately NOT on the card. "Few seats" is true of one
  // date and is shown beside that date (date picker, departures list); a card
  // summarises the whole trip and a seat warning there reads as a claim about
  // all of it. Only "sold out" is a statement about the trip, and it has its badge.
  const saleLabel = saleBadgeLabel(trip);
  const soldOut = isSoldOutDeparture(departure);

  return (
    <Link
      href={`/${locale}/trips/${trip.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        {trip.image ? (
          <Image
            src={trip.image}
            alt={trip.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
            quality={90}
            priority={eager}
            className="uudam-photo-drift object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Зураг байхгүй
          </div>
        )}

        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5 sm:left-3 sm:top-3">
          {trip.isFeatured && (
            <span className="rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold text-navy-deep">
              Онцлох
            </span>
          )}
          {saleLabel && (
            <span className="rounded-full bg-destructive px-2.5 py-1 text-[11px] font-bold text-destructive-foreground">
              {saleLabel}
            </span>
          )}
          {soldOut && (
            <span className="rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
              Суудал дүүрсэн
            </span>
          )}
        </div>

        <div className="absolute right-2 top-2 flex items-center gap-1.5 sm:right-3 sm:top-3">
          {hasVideo && (
            <span className="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              <Play className="h-3 w-3 fill-current" />
              Бичлэг
            </span>
          )}
          <SaveButton slug={trip.slug} />
        </div>

        {trip.country && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm sm:bottom-3 sm:left-3">
            <MapPin className="h-3 w-3" />
            {trip.country}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 flex-1 text-sm font-semibold leading-snug sm:text-[15px]">
            {formatTripTitle(trip.title)}
          </h3>
          {trip.reviewCount > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-gold text-gold" />
              {trip.avgRating.toFixed(1)}
            </span>
          )}
        </div>

        {trip.summary && (
          <p className="mt-1.5 hidden text-[13px] leading-relaxed text-muted-foreground sm:line-clamp-2">
            {trip.summary}
          </p>
        )}

        {trip.tags.length > 0 && (
          <div className="mt-1.5 hidden flex-wrap gap-1 sm:flex">
            {trip.tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:mt-3 sm:gap-x-3.5">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {trip.durationDays} хоног
          </span>
          {departure && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDepartureDate(departure.startDate)}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between pt-3 sm:pt-4">
          <div>
            {hasKnownTripPrice(price) && trip.oldPrice && trip.oldPrice > price && (
              <div className="text-xs text-muted-foreground line-through">
                {formatMnt(trip.oldPrice)}
              </div>
            )}
            <div className="text-[15px] font-bold text-primary sm:text-[17px]">{formatTripStartingPrice(price)}</div>
            <div className="text-[11px] text-muted-foreground">
              {hasKnownTripPrice(price) ? "хүн/-с эхлэн" : "ажилтнаас тодруулна"}
            </div>
          </div>

          <span className="hidden rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground sm:inline-block">
            Дэлгэрэнгүй
          </span>
        </div>
      </div>
    </Link>
  );
}
