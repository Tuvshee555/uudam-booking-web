"use client";

import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";

import type { Trip } from "@/types/trip";
import { formatMnt, hasKnownTripPrice } from "@/lib/pricing";
import { formatDepartureDate, startingPrice } from "@/lib/departures";
import { saleBadgeLabel } from "@/lib/tripMarketing";
import { tripDestinations } from "@/lib/destinations";
import { tripStatus } from "@/lib/tripStatus";
import { formatTripTitle, isAllCapsTitle } from "@/lib/tripDisplay";
import { canonicalPath } from "@/lib/locales";
import SaveButton from "@/components/trip/SaveButton";
import { cn } from "@/lib/utils";

/**
 * A trip in a grid: photo, where it goes, the title, the next open date and
 * the "-с эхлэн" price. Borderless on purpose — the photo is the card.
 *
 * The whole card is one link (the title's ::after covers it), with the save
 * heart layered above it rather than nested inside it: a button inside a link
 * is invalid HTML and reads twice to a screen reader.
 *
 * `eager` marks a card visible without scrolling so its photo loads with the
 * page instead of popping in.
 */
export default function TripCard({
  trip,
  eager = false,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
  headingLevel = 3,
}: {
  trip: Trip;
  eager?: boolean;
  sizes?: string;
  headingLevel?: 2 | 3;
}) {
  const href = canonicalPath(`/trips/${trip.slug}`);
  const price = startingPrice(trip);
  const priced = hasKnownTripPrice(price);
  const status = tripStatus(trip);
  const places = tripDestinations(trip);
  const saleLabel = saleBadgeLabel(trip);
  const hasVideo = Boolean(trip.video) || trip.videos.length > 0;
  const title = formatTripTitle(trip.title);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-sand">
        {trip.image ? (
          <Image
            src={trip.image}
            alt=""
            fill
            sizes={sizes}
            quality={75}
            priority={eager}
            className="photo-zoom object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Зураг удахгүй</div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />

        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5 sm:left-3 sm:top-3">
          {trip.isFeatured && (
            <span className="rounded-full bg-gold px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-navy-night">Онцлох</span>
          )}
          {saleLabel && (
            <span className="rounded-full bg-destructive px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white">{saleLabel}</span>
          )}
          {status.kind === "full" && (
            <span className="rounded-full bg-navy-night/85 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white backdrop-blur">Дүүрсэн</span>
          )}
        </div>

        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-navy-night backdrop-blur sm:bottom-3 sm:left-3">
          {trip.durationDays} хоног
        </span>
        {hasVideo && (
          <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10.5px] font-semibold text-white backdrop-blur sm:bottom-3 sm:right-3">
            <Play className="h-3 w-3 fill-current" aria-hidden="true" />
            Бичлэг
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-3.5 sm:pt-4">
        {places.length > 0 && (
          <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.18em] text-gold-text sm:text-[11px]">
            {places.slice(0, 2).map((place) => place.label).join(" · ")}
          </p>
        )}
        <Heading
          className={cn(
            "mt-1.5 line-clamp-3 font-semibold leading-snug text-foreground sm:line-clamp-2",
            isAllCapsTitle(title) ? "text-[13px] tracking-[0.015em] sm:text-[14px]" : "text-[14px] sm:text-[15.5px]",
          )}
        >
          <Link href={href} className="link-draw rounded-sm focus-visible:outline-none after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background">
            {title}
          </Link>
        </Heading>

        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground sm:text-[13px]">
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              status.kind === "open" ? (status.tight ? "bg-warning" : "bg-success") : status.kind === "full" ? "bg-destructive" : "bg-muted-foreground/50",
            )}
          />
          <span className="truncate">
            {status.kind === "open" && (
              <>
                {formatDepartureDate(status.departure.startDate)}
                {status.tight ? <span className="font-semibold text-warning"> · Цөөн суудал</span> : status.openCount > 1 ? ` · +${status.openCount - 1} огноо` : ""}
              </>
            )}
            {status.kind === "full" && "Бүх огноо дүүрсэн"}
            {status.kind === "no-dates" && "Огноог ажилтнаас лавлана"}
          </span>
        </p>

        <div className="mt-auto flex items-baseline justify-between gap-2 border-t border-border pt-3 sm:mt-4">
          {priced ? (
            <>
              <span className="text-[11px] text-muted-foreground">-с эхлэн</span>
              <span className="text-right">
                {trip.oldPrice && trip.oldPrice > price && (
                  <span className="mr-1.5 text-[11px] text-muted-foreground line-through">{formatMnt(trip.oldPrice)}</span>
                )}
                <span className="text-[15px] font-bold tabular-nums text-foreground sm:text-[17px]">{formatMnt(price)}</span>
              </span>
            </>
          ) : (
            <span className="text-[13px] font-semibold text-foreground">Үнэ лавлах</span>
          )}
        </div>
      </div>

      <SaveButton slug={trip.slug} className="absolute right-2.5 top-2.5 z-10 sm:right-3 sm:top-3" />
    </article>
  );
}
