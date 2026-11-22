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
import { formatTripDuration, formatTripTitle, isAllCapsTitle } from "@/lib/tripDisplay";
import { canonicalPath } from "@/lib/locales";
import SaveButton from "@/components/trip/SaveButton";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

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
  const duration = formatTripDuration(trip.durationDays, trip.durationNights);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  if (BRAND.key === "magnai") {
    return (
      <MagnaiTripCard
        trip={trip} eager={eager} sizes={sizes} Heading={Heading} href={href} price={price} priced={priced}
        status={status} places={places} saleLabel={saleLabel} hasVideo={hasVideo} title={title} duration={duration}
      />
    );
  }

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
            fetchPriority={eager ? "high" : undefined}
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

        {/* One row, so the longer "9 өдөр 8 шөнө" can never run under the video badge on a narrow card. */}
        {(duration || hasVideo) && (
          <div className="absolute inset-x-2.5 bottom-2.5 flex items-end justify-between gap-1.5 sm:inset-x-3 sm:bottom-3">
            {duration ? (
              <span className="min-w-0 truncate rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-navy-night backdrop-blur">
                {duration}
              </span>
            ) : <span />}
            {hasVideo && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10.5px] font-semibold text-white backdrop-blur">
                <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                Бичлэг
              </span>
            )}
          </div>
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

/**
 * Magnai's card (lib/brand.ts): a boxed ticket rather than Uudam's borderless photo — a landscape
 * photo, the facts on the card, and the price on a midnight strip in gold. Same link, save button,
 * badges and data as Uudam's card.
 */
function MagnaiTripCard({
  trip, eager, sizes, Heading, href, price, priced, status, places, saleLabel, hasVideo, title, duration,
}: {
  trip: Trip; eager: boolean; sizes: string; Heading: "h2" | "h3"; href: string; price: number; priced: boolean;
  status: ReturnType<typeof tripStatus>; places: ReturnType<typeof tripDestinations>; saleLabel: string | null;
  hasVideo: boolean; title: string; duration: string;
}) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-md border border-border bg-card shadow-[0_1px_2px_rgba(1,28,58,0.06)] transition-shadow duration-300 hover:shadow-[0_18px_40px_-22px_rgba(1,28,58,0.45)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-sand">
        {trip.image ? (
          <Image
            src={trip.image}
            alt=""
            fill
            sizes={sizes}
            quality={75}
            priority={eager}
            fetchPriority={eager ? "high" : undefined}
            className="photo-zoom object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Зураг удахгүй</div>
        )}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {trip.isFeatured && (
            <span className="rounded-sm bg-gold px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-navy-night">Онцлох</span>
          )}
          {saleLabel && (
            <span className="rounded-sm bg-destructive px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">{saleLabel}</span>
          )}
          {status.kind === "full" && (
            <span className="rounded-sm bg-navy-night/85 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur">Дүүрсэн</span>
          )}
        </div>
        {hasVideo && (
          <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-sm bg-black/60 px-2 py-1 text-[10.5px] font-semibold text-white backdrop-blur">
            <Play className="h-3 w-3 fill-current" aria-hidden="true" />
            Бичлэг
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3 sm:px-4">
        <div className="flex items-center justify-between gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] sm:text-[11px]">
          <span className="min-w-0 truncate text-gold-text">{places.slice(0, 2).map((place) => place.label).join(" · ")}</span>
          {duration && <span className="shrink-0 text-muted-foreground">{duration}</span>}
        </div>
        <Heading
          className={cn(
            "mt-1.5 line-clamp-3 font-semibold leading-snug text-foreground sm:line-clamp-2",
            isAllCapsTitle(title) ? "text-[13px] tracking-[0.015em] sm:text-[14px]" : "text-[14px] sm:text-[15.5px]",
          )}
        >
          <Link href={href} className="rounded-sm focus-visible:outline-none after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background">
            {title}
          </Link>
        </Heading>
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground sm:text-[13px]">
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 w-1.5 shrink-0 rotate-45",
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
      </div>

      <div className="mt-auto flex items-baseline justify-between gap-2 bg-[hsl(var(--uudam-navy-deep))] px-3.5 py-2.5 sm:px-4">
        {priced ? (
          <>
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">-с эхлэн</span>
            <span className="text-right">
              {trip.oldPrice && trip.oldPrice > price && (
                <span className="mr-1.5 text-[11px] text-white/50 line-through">{formatMnt(trip.oldPrice)}</span>
              )}
              <span className="text-[15px] font-bold tabular-nums text-gold sm:text-[17px]">{formatMnt(price)}</span>
            </span>
          </>
        ) : (
          <span className="text-[13px] font-semibold text-white">Үнэ лавлах</span>
        )}
      </div>

      <SaveButton slug={trip.slug} className="absolute right-2.5 top-2.5 z-10" />
    </article>
  );
}
