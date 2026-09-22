"use client";

import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Clock, MapPin, Play, Star, Users } from "lucide-react";

import type { Trip } from "@/types/trip";
import { formatMnt, formatTripStartingPrice, hasKnownTripPrice } from "@/lib/pricing";
import { availability, formatDepartureDate, nextDeparture } from "@/lib/departures";
import {
  isSoldOutDeparture,
  marketingSeatFacts,
  saleBadgeLabel,
} from "@/lib/tripMarketing";
import SaveButton from "@/components/trip/SaveButton";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { cn } from "@/lib/utils";
import { formatTripTitle } from "@/lib/tripDisplay";

export default function TripCard({ trip }: { trip: Trip }) {
  const { locale } = useI18n();
  const departure = nextDeparture(trip);
  const hasVideo = Boolean(trip.video) || trip.videos.length > 0;

  const seats = departure ? availability(departure) : null;
  const saleLabel = saleBadgeLabel(trip);
  const seatFacts = marketingSeatFacts(trip);
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
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            quality={90}
            className="uudam-photo-drift object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Зураг байхгүй
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
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

        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {hasVideo && (
            <span className="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              <Play className="h-3 w-3 fill-current" />
              Бичлэг
            </span>
          )}
          <SaveButton slug={trip.slug} />
        </div>

        {trip.country && (
          <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            <MapPin className="h-3 w-3" />
            {trip.country}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 flex-1 text-[15px] font-semibold leading-snug">
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
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            {trip.summary}
          </p>
        )}

        {trip.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
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

        {seatFacts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {seatFacts.map((fact) => (
              <span
                key={fact}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  fact === "Суудал дүүрсэн"
                    ? "border-destructive/25 bg-destructive/10 text-destructive"
                    : "border-gold/30 bg-gold/10 text-navy-deep dark:text-gold",
                )}
              >
                {fact}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground">
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
          {seats && (
            <span
              className={cn(
                "flex items-center gap-1",
                seats.tone === "tight" && "font-semibold text-destructive",
                seats.tone === "closed" && "font-semibold text-destructive",
              )}
            >
              <Users className="h-3.5 w-3.5" />
              {seats.label}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            {hasKnownTripPrice(trip.price) && trip.oldPrice && trip.oldPrice > trip.price && (
              <div className="text-xs text-muted-foreground line-through">
                {formatMnt(trip.oldPrice)}
              </div>
            )}
            <div className="text-[17px] font-bold text-primary">{formatTripStartingPrice(trip.price)}</div>
            <div className="text-[11px] text-muted-foreground">
              {hasKnownTripPrice(trip.price) ? "хүн/-с эхлэн" : "ажилтнаас тодруулна"}
            </div>
          </div>

          <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
            Дэлгэрэнгүй
          </span>
        </div>
      </div>
    </Link>
  );
}
