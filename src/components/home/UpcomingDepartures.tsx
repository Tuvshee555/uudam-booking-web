import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

import SectionHeading from "@/components/site/SectionHeading";
import type { DepartureRow } from "@/lib/homeSections";
import { departureDateKey } from "@/lib/departureDate";
import { tripDestinations } from "@/lib/destinations";
import { canonicalPath } from "@/lib/locales";
import { formatMnt } from "@/lib/pricing";
import { formatTripTitle } from "@/lib/tripDisplay";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

/** The next open date of each trip, like a departures board: date, trip, price for that date. */
export default function UpcomingDepartures({ rows }: { rows: DepartureRow[] }) {
  if (!rows.length) return null;

  return (
    <section aria-labelledby="departures-title" className="mt-20 bg-sand/70 py-20 lg:mt-28 lg:py-28">
      <div className="site-container grid gap-12 lg:grid-cols-[0.8fr_1.6fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            id="departures-title"
            eyebrow="Ойрын хөдлөлт"
            title="Удахгүй хөдлөх аялалууд"
            description="Аялал бүрийн захиалга авч буй хамгийн ойрын огноо, тухайн огнооны нэг том хүний үнэ."
          />
          <Link
            href={canonicalPath("/departures")}
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-ring"
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Хуанлиар харах
          </Link>
        </div>

        <ol className="divide-y divide-border border-y border-border">
          {rows.map(({ trip, departure, price, tight }) => {
            const day = departureDateKey(departure.startDate);
            const [year, month, date] = day.split("-").map(Number);
            const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, date)).getUTCDay()];
            const place = tripDestinations(trip)[0];
            return (
              <li key={`${trip.id}:${departure.id}`}>
                <Link
                  href={`${canonicalPath(`/trips/${trip.slug}`)}?departure=${day}`}
                  className="group grid grid-cols-[4.25rem_1fr_auto] items-center gap-4 py-5 focus-ring sm:grid-cols-[5.5rem_1fr_auto_auto] sm:gap-6"
                >
                  <span className="text-center">
                    <span className="numeral block text-[2.6rem] leading-none text-foreground sm:text-[3rem]">{date}</span>
                    <span className="mt-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground">{month}-р сар</span>
                    <span className="block text-[11px] text-muted-foreground">{weekday}</span>
                  </span>
                  <span className="min-w-0">
                    {place && <span className="block text-[10.5px] font-semibold uppercase tracking-[0.2em] text-gold-text">{place.label}</span>}
                    <span className="mt-1 line-clamp-2 block text-[15px] font-semibold leading-snug text-foreground group-hover:underline group-hover:decoration-gold group-hover:underline-offset-4">
                      {formatTripTitle(trip.title)}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
                      {trip.durationDays} хоног
                      <span aria-hidden="true">·</span>
                      <span className={cn("inline-flex items-center gap-1.5 font-medium", tight ? "text-warning" : "text-success")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", tight ? "bg-warning" : "bg-success")} aria-hidden="true" />
                        {tight ? "Цөөн суудал" : "Захиалга нээлттэй"}
                      </span>
                    </span>
                  </span>
                  <span className="hidden text-right sm:block">
                    {price ? (
                      <>
                        <span className="block text-[17px] font-bold tabular-nums text-foreground">{formatMnt(price)}</span>
                        <span className="text-[11px] text-muted-foreground">нэг том хүн</span>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-foreground">Үнэ лавлах</span>
                    )}
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {price && (
                    <span className="col-start-2 -mt-2 text-[14px] font-bold tabular-nums text-foreground sm:hidden">
                      {formatMnt(price)} <span className="text-[11px] font-normal text-muted-foreground">/ том хүн</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
