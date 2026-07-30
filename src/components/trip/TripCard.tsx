"use client";

import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Clock, MapPin, Play, Star, Users } from "lucide-react";

import type { Trip } from "@/types/trip";
import { formatMnt } from "@/lib/pricing";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { cn } from "@/lib/utils";

/** Soonest departure that is still open, or null if the trip has none listed. */
function nextDeparture(trip: Trip) {
  const now = Date.now();
  return (
    trip.departures
      .filter(
        (departure) =>
          new Date(departure.startDate).getTime() >= now &&
          departure.status !== "CANCELLED" &&
          departure.status !== "DEPARTED",
      )
      .sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      )[0] ?? null
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("mn-MN", {
    month: "short",
    day: "numeric",
  });
}

export default function TripCard({ trip }: { trip: Trip }) {
  const { locale } = useI18n();
  const departure = nextDeparture(trip);
  const hasVideo = Boolean(trip.video) || trip.videos.length > 0;

  const seatsLeft = departure?.seatsLeft ?? null;
  const scarce = seatsLeft !== null && seatsLeft > 0 && seatsLeft <= 5;

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
            className="object-cover transition-transform duration-500 group-hover:scale-105"
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
          {typeof trip.discount === "number" && trip.discount > 0 && (
            <span className="rounded-full bg-destructive px-2.5 py-1 text-[11px] font-bold text-destructive-foreground">
              -{trip.discount}%
            </span>
          )}
        </div>

        {hasVideo && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Play className="h-3 w-3 fill-current" />
            Бичлэг
          </span>
        )}

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
            {trip.title}
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

        <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {trip.durationDays} хоног
          </span>
          {departure && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(departure.startDate)}
            </span>
          )}
          {seatsLeft !== null && (
            <span className={cn("flex items-center gap-1", scarce && "font-semibold text-destructive")}>
              <Users className="h-3.5 w-3.5" />
              {seatsLeft > 0 ? `${seatsLeft} суудал` : "Дүүрсэн"}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            {trip.oldPrice && trip.oldPrice > trip.price && (
              <div className="text-xs text-muted-foreground line-through">
                {formatMnt(trip.oldPrice)}
              </div>
            )}
            <div className="text-[17px] font-bold text-primary">{formatMnt(trip.price)}</div>
            <div className="text-[11px] text-muted-foreground">хүн/-с эхлэн</div>
          </div>

          <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
            Дэлгэрэнгүй
          </span>
        </div>
      </div>
    </Link>
  );
}
