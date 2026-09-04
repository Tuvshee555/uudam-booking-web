"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Clock, ImageOff, MapPin } from "lucide-react";

import type { Trip } from "@/types/trip";
import { availability, upcomingDepartures } from "@/lib/departures";
import { formatMnt } from "@/lib/pricing";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { cn } from "@/lib/utils";

type Row = {
  key: string;
  trip: Trip;
  departure: ReturnType<typeof upcomingDepartures>[number];
};

/**
 * Departures grouped by month.
 *
 * A month list rather than a calendar grid: the catalogue carries on the order
 * of a dozen upcoming dates, and a 30-cell grid with three filled squares
 * communicates emptiness rather than availability.
 */
export default function DeparturesPageClient({ trips }: { trips: Trip[] }) {
  const { locale } = useI18n();
  const [now] = useState(() => Date.now());

  const months = useMemo(() => {
    const rows: Row[] = [];

    for (const trip of trips) {
      for (const departure of upcomingDepartures(trip, now)) {
        rows.push({ key: `${trip.id}:${departure.id}`, trip, departure });
      }
    }

    rows.sort(
      (a, b) =>
        new Date(a.departure.startDate).getTime() - new Date(b.departure.startDate).getTime(),
    );

    const grouped = new Map<string, { label: string; rows: Row[] }>();

    for (const row of rows) {
      const date = new Date(row.departure.startDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          label: date.toLocaleDateString("mn-MN", { year: "numeric", month: "long" }),
          rows: [],
        });
      }
      grouped.get(key)!.rows.push(row);
    }

    return Array.from(grouped.entries()).map(([key, value]) => ({ key, ...value }));
  }, [trips, now]);

  const total = months.reduce((sum, month) => sum + month.rows.length, 0);

  return (
    <div className="uudam-container py-8">
      <header>
        <h1 className="text-2xl font-bold md:text-3xl">Аяллын хуваарь</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Ойрын хугацаанд хөдлөх аяллуудыг огноогоор нь харна уу.
        </p>
      </header>

      {total === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border py-16 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Одоогоор товлосон огноо алга</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Хүссэн огноогоо хэлбэл бид тохируулж өгнө.
          </p>
          <Link
            href={`/${locale}/custom-trip`}
            className="mt-5 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Захиалгат аялал хүсэх
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {months.map((month) => (
            <section key={month.key}>
              <h2 className="text-lg font-bold capitalize">{month.label}</h2>
              <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
                {month.rows.map(({ key, trip, departure }) => {
                  const seats = availability(departure);
                  const date = new Date(departure.startDate);

                  return (
                    <li key={key}>
                      <Link
                        href={`/${locale}/trips/${trip.slug}`}
                        className="flex items-center gap-4 p-3.5 transition-colors hover:bg-secondary/50"
                      >
                        <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-secondary py-2">
                          <span className="text-lg font-bold leading-none">{date.getDate()}</span>
                          <span className="mt-0.5 text-[11px] text-muted-foreground">
                            {date.toLocaleDateString("mn-MN", { month: "short" })}
                          </span>
                        </div>

                        <div className="relative hidden h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-secondary sm:block">
                          {trip.image ? (
                            <Image
                              src={trip.image}
                              alt={trip.title}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          ) : (
                            <ImageOff className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{trip.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {trip.country && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {trip.country}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {trip.durationDays} хоног
                            </span>
                            <span
                              className={cn(
                                seats.tone === "tight" && "font-semibold text-destructive",
                              )}
                            >
                              {seats.label}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-sm font-bold text-primary">
                            {formatMnt(departure.price ?? trip.price)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">хүн/-с эхлэн</div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
