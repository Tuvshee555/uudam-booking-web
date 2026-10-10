"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import type { Departure, Trip } from "@/types/trip";
import { availability, formatYearMonthLong, upcomingDepartures } from "@/lib/departures";
import { departureDateKey } from "@/lib/departureDate";
import { formatTripStartingPrice } from "@/lib/pricing";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { cn } from "@/lib/utils";

type Row = { trip: Trip; departure: Departure };
const weekdays = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

export default function DeparturesPageClient({ trips }: { trips: Trip[] }) {
  const { locale } = useI18n();
  const [now] = useState(() => Date.now());
  const months = useMemo(() => {
    const grouped = new Map<string, Row[]>();
    for (const trip of trips) {
      for (const departure of upcomingDepartures(trip, now)) {
        const key = departureDateKey(departure.startDate).slice(0, 7);
        grouped.set(key, [...(grouped.get(key) || []), { trip, departure }]);
      }
    }
    return [...grouped].sort(([a], [b]) => a.localeCompare(b));
  }, [trips, now]);
  const [monthKey, setMonthKey] = useState(() => months[0]?.[0] || "");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const resultsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selectedDay) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedDay]);
  const index = Math.max(0, months.findIndex(([key]) => key === monthKey));
  const month = months[index];

  return (
    <div className="uudam-container max-w-6xl py-8">
      <header>
        <h1 className="text-2xl font-bold md:text-3xl">Аяллын хуваарь</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Явах өдрөө сонгоод тухайн өдрийн аяллуудыг харна уу.</p>
      </header>

      {!month ? (
        <div className="mt-10 border-y border-border py-16 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Одоогоор товлосон огноо алга</p>
          <Link href={`/${locale}/custom-trip`} className="mt-5 inline-block text-sm font-semibold text-primary underline">Захиалгат аялал хүсэх</Link>
        </div>
      ) : (() => {
        const [key, rows] = month;
        const [year, monthNumber] = key.split("-").map(Number);
        const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
        const leading = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
        const byDay = new Map<number, Row[]>();
        for (const row of rows) {
          const day = Number(departureDateKey(row.departure.startDate).slice(8, 10));
          byDay.set(day, [...(byDay.get(day) || []), row]);
        }
        const activeDay = selectedDay && byDay.has(selectedDay) ? selectedDay : null;
        const activeRows = activeDay ? byDay.get(activeDay) || [] : [];
        return <>
          <div className="mt-7 flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-lg font-bold">{formatYearMonthLong(new Date(`${key}-01T00:00:00Z`))}</h2>
            <div className="flex items-center gap-1">
              <button type="button" title="Өмнөх сар" aria-label="Өмнөх сар" disabled={index === 0}
                onClick={() => { setMonthKey(months[index - 1][0]); setSelectedDay(null); }}
                className="flex h-9 w-9 items-center justify-center disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" title="Дараагийн сар" aria-label="Дараагийн сар" disabled={index === months.length - 1}
                onClick={() => { setMonthKey(months[index + 1][0]); setSelectedDay(null); }}
                className="flex h-9 w-9 items-center justify-center disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-px border border-border bg-border text-center text-xs text-muted-foreground">
            {weekdays.map((day) => <div key={day} className="bg-background py-2 font-medium">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-px border-x border-b border-border bg-border">
            {Array.from({ length: leading }, (_, i) => <div key={`blank-${i}`} className="min-h-20 bg-background" />)}
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1;
              const dayRows = byDay.get(day) || [];
              return <button key={day} type="button" disabled={dayRows.length === 0} onClick={() => setSelectedDay(day)}
                aria-label={`${key}-${String(day).padStart(2, "0")}: ${dayRows.length} аялал`}
                aria-pressed={activeDay === day}
                className={cn("min-w-0 min-h-20 bg-background p-1.5 text-left align-top transition-colors sm:p-2",
                  dayRows.length ? "hover:bg-secondary/60" : "text-muted-foreground/50",
                  activeDay === day && "bg-primary/10 ring-1 ring-inset ring-primary")}
              >
                <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded text-xs font-semibold tabular-nums", activeDay === day && "bg-primary text-primary-foreground")}>{day}</span>
                {dayRows.length > 0 && <>
                  <span className="mt-1 block text-[10px] font-medium leading-tight text-primary sm:hidden">{dayRows.length} аялал</span>
                  <span className="mt-1 hidden truncate text-xs font-medium leading-tight text-foreground sm:block">{dayRows[0].trip.title}</span>
                  {dayRows.length > 1 && <span className="mt-1 hidden text-[10px] text-muted-foreground sm:block">+{dayRows.length - 1} аялал</span>}
                </>}
              </button>;
            })}
            {Array.from({ length: (7 - ((leading + days) % 7)) % 7 }, (_, i) =>
              <div key={`tail-${i}`} className="min-h-20 bg-background" />)}
          </div>

          {activeDay && <section ref={resultsRef} className="mt-5 scroll-mt-20" aria-live="polite">
            <h3 className="mb-2 text-base font-semibold">{monthNumber}-р сарын {activeDay} · {activeRows.length} аялал</h3>
            <ul className="divide-y divide-border border-y border-border">
              {activeRows.map(({ trip, departure }) => {
                const seats = availability(departure);
                return <li key={`${trip.id}:${departure.id}`}>
                  <Link href={`/${locale}/trips/${trip.slug}?departure=${departureDateKey(departure.startDate)}`}
                    className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-primary">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{trip.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{trip.durationDays} хоног · <span className={seats.tone !== "open" ? "font-semibold text-destructive" : ""}>{seats.label}</span></div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold tabular-nums text-primary">{formatTripStartingPrice(departure.price ?? trip.price)}</div>
                      <div className="text-[10px] text-muted-foreground">хүнээс эхлэх</div>
                    </div>
                  </Link>
                </li>;
              })}
            </ul>
          </section>}
        </>;
      })()}
    </div>
  );
}
