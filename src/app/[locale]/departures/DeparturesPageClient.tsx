"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarX2, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import type { Departure, Trip } from "@/types/trip";
import { availability, upcomingDepartures } from "@/lib/departures";
import { departureDateKey } from "@/lib/departureDate";
import { addMonths, compareMonths, dayTitle, monthGrid, monthOf, monthTitle, ulaanbaatarDay, WEEKDAYS_MN, type DayKey, type MonthKey } from "@/lib/calendar";
import { tripDestinations } from "@/lib/destinations";
import { canonicalPath } from "@/lib/locales";
import { formatMnt, hasKnownTripPrice } from "@/lib/pricing";
import { track } from "@/lib/analytics";
import { formatTripDuration, formatTripTitle } from "@/lib/tripDisplay";
import { cn } from "@/lib/utils";
import Listbox from "@/components/ui/listbox";

type Row = { trip: Trip; departure: Departure; day: DayKey; price: number | null; open: boolean; tight: boolean; label: string };

/** How far ahead the calendar can be paged, past the last scheduled departure. */
const LOOKAHEAD_MONTHS = 2;
const AGENDA_PAGE = 12;

export default function DeparturesPageClient({ trips, today: renderedToday, now: renderedNow }: { trips: Trip[]; today: DayKey; now: number }) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? canonicalPath("/departures");

  // The page is cached for up to five minutes, so it can reach a visitor just
  // after midnight still saying "yesterday". Render with the server's clock
  // (so hydration matches), then move to the visitor's own clock — only when
  // the date has changed: re-rendering the whole month on every visit for a
  // few minutes' difference was the page's longest task on a phone.
  const [clock, setClock] = useState({ today: renderedToday, now: renderedNow });
  useEffect(() => {
    const current = Date.now();
    const currentDay = ulaanbaatarDay(current);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (currentDay !== renderedToday) setClock({ today: currentDay, now: current });
  }, [renderedToday]);
  const { today, now } = clock;
  const currentMonth = monthOf(today);

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    for (const trip of trips) {
      for (const departure of upcomingDepartures(trip, now)) {
        const seats = availability(departure);
        const price = departure.price ?? trip.price;
        list.push({
          trip,
          departure,
          day: departureDateKey(departure.startDate),
          price: hasKnownTripPrice(price) ? price : null,
          open: seats.selectable,
          tight: seats.tone === "tight",
          label: seats.label,
        });
      }
    }
    return list.sort((a, b) => a.day.localeCompare(b.day) || Number(b.open) - Number(a.open));
  }, [trips, now]);

  const destinationFilter = searchParams.get("dest");
  const visibleRows = useMemo(
    () => (destinationFilter ? rows.filter((row) => tripDestinations(row.trip).some((destination) => destination.key === destinationFilter)) : rows),
    [rows, destinationFilter],
  );
  const destinationOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const row of rows) {
      for (const destination of tripDestinations(row.trip)) {
        const entry = counts.get(destination.key) ?? { label: destination.label, count: 0 };
        entry.count += 1;
        counts.set(destination.key, entry);
      }
    }
    return [...counts].sort((a, b) => b[1].count - a[1].count);
  }, [rows]);

  const lastMonth = visibleRows.length ? monthOf(visibleRows[visibleRows.length - 1].day) : currentMonth;
  const maxMonth = addMonths(compareMonths(lastMonth, currentMonth) > 0 ? lastMonth : currentMonth, LOOKAHEAD_MONTHS);

  const requested = searchParams.get("month");
  const month: MonthKey =
    requested && /^\d{4}-\d{2}$/.test(requested) && compareMonths(requested, currentMonth) >= 0 && compareMonths(requested, maxMonth) <= 0
      ? requested
      : currentMonth;
  const requestedDay = searchParams.get("date");
  const selectedDay = requestedDay && monthOf(requestedDay) === month ? requestedDay : null;

  const setParams = (next: { month?: MonthKey; date?: DayKey | null; dest?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.month !== undefined) {
      if (next.month === currentMonth) params.delete("month");
      else params.set("month", next.month);
    }
    if (next.date !== undefined) {
      if (next.date) params.set("date", next.date);
      else params.delete("date");
    }
    if (next.dest !== undefined) {
      if (next.dest) params.set("dest", next.dest);
      else params.delete("dest");
    }
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  };

  const byDay = new Map<DayKey, Row[]>();
  for (const row of visibleRows) {
    if (monthOf(row.day) !== month) continue;
    byDay.set(row.day, [...(byDay.get(row.day) ?? []), row]);
  }

  const monthRows = [...byDay.values()].flat();
  const nextMonthWithDepartures = visibleRows.find((row) => compareMonths(monthOf(row.day), month) > 0)?.day;
  // A month with nothing left still answers "when can I go?": the next open dates.
  const comingUp = monthRows.length === 0 && !selectedDay
    ? visibleRows.filter((row) => row.open && compareMonths(monthOf(row.day), month) > 0).slice(0, 6)
    : [];
  const shown = selectedDay ? byDay.get(selectedDay) ?? [] : monthRows.length ? monthRows : comingUp;
  // A busy month lists dozens of departures; the first dozen, then the rest on request.
  const listKey = `${month}|${selectedDay ?? ""}|${destinationFilter ?? ""}`;
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const listed = selectedDay || expandedKey === listKey ? shown : shown.slice(0, AGENDA_PAGE);
  const tripCount = new Set(monthRows.map((row) => row.trip.id)).size;

  return (
    <div className="site-container pb-20 pt-8 lg:pt-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setParams({ month: addMonths(month, -1), date: null })}
            disabled={compareMonths(month, currentMonth) <= 0}
            aria-label="Өмнөх сар"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-foreground/40 focus-ring disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <h2 className="display-3 min-w-[12rem] text-center text-foreground" aria-live="polite">{monthTitle(month)}</h2>
          <button
            type="button"
            onClick={() => setParams({ month: addMonths(month, 1), date: null })}
            disabled={compareMonths(month, maxMonth) >= 0}
            aria-label="Дараагийн сар"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-foreground/40 focus-ring disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          {month !== currentMonth && (
            <button type="button" onClick={() => setParams({ month: currentMonth, date: null })} className="ml-1 rounded-full px-3 py-2 text-[13px] font-semibold text-foreground underline decoration-gold underline-offset-4 focus-ring">
              Энэ сар
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          Чиглэл
          <Listbox
            value={destinationFilter ?? ""}
            options={[{ value: "", label: "Бүх чиглэл" }, ...destinationOptions.map(([key, entry]) => ({ value: key, label: entry.label, hint: String(entry.count) }))]}
            onChange={(dest) => setParams({ dest: dest || null, date: null })}
            ariaLabel="Чиглэл"
            align="right"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card pl-4 pr-3 text-[13px] font-semibold text-foreground transition-colors hover:border-foreground/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 aria-expanded:border-foreground/40"
          >
            {(selected, open) => (
              <>
                <span className="max-w-[10rem] truncate">{selected?.label ?? "Бүх чиглэл"}</span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
              </>
            )}
          </Listbox>
        </div>
      </div>

      <p className="mt-4 text-[14px] text-muted-foreground">
        {monthRows.length ? (
          <>
            Энэ сард <span className="font-semibold text-foreground">{tripCount}</span> аяллын{" "}
            <span className="font-semibold text-foreground">{monthRows.length}</span> хөдлөлт. Өдрөө сонгоод тухайн өдөр гарах аяллуудыг харна уу.
          </>
        ) : (
          "Энэ сард товлосон хөдлөлт алга."
        )}
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12">
        <div>
          <div className="grid grid-cols-7 border-b border-border pb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground" aria-hidden="true">
            {WEEKDAYS_MN.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div role="group" aria-label={monthTitle(month)} className="mt-2 grid grid-cols-7 gap-1 sm:gap-1.5">
            {monthGrid(month).map((cell, index) => {
              if (!cell) return <span key={`blank-${index}`} aria-hidden="true" />;
              const dayRows = byDay.get(cell.key) ?? [];
              const openRows = dayRows.filter((row) => row.open);
              const past = cell.key < today;
              const isToday = cell.key === today;
              const active = cell.key === selectedDay;
              const allFull = dayRows.length > 0 && openRows.length === 0;
              return (
                <button
                  key={cell.key}
                  type="button"
                  data-day={cell.key}
                  disabled={past || dayRows.length === 0}
                  aria-pressed={active}
                  onClick={() => {
                    setParams({ date: active ? null : cell.key });
                    if (!active) track("calendar_select", { properties: { day: cell.key, departures: dayRows.length } });
                  }}
                  className={cn(
                    "relative flex min-h-[3.75rem] flex-col items-start rounded-md border p-1.5 text-left transition-colors focus-ring sm:min-h-[5.5rem] sm:p-2",
                    // Empty days keep a faint outline, so a week with nothing on Mondays still reads as a calendar.
                    dayRows.length === 0 && "border-border/40",
                    dayRows.length > 0 && !active && "border-border bg-card hover:border-foreground/35",
                    active && "border-primary bg-primary text-primary-foreground",
                    past && "opacity-40",
                    allFull && !active && "bg-secondary/60",
                  )}
                >
                  <span
                    className={cn(
                      "text-[13px] tabular-nums sm:text-sm",
                      dayRows.length ? "font-semibold" : "text-muted-foreground",
                      isToday && !active && "flex h-6 w-6 items-center justify-center rounded-full bg-gold text-navy-night",
                    )}
                  >
                    {cell.day}
                  </span>
                  {/* Named by what it shows plus the full date, so the spoken name contains the visible one. */}
                  <span className="sr-only">
                    {`, ${dayTitle(cell.key)}${dayRows.length ? `: ${dayRows.length} хөдлөлт${allFull ? ", бүгд дүүрсэн" : ""}` : ""}`}
                  </span>
                  {dayRows.length > 0 && (
                    <>
                      <span
                        className={cn(
                          "mt-auto text-[10.5px] font-semibold leading-tight sm:hidden",
                          active ? "text-primary-foreground" : allFull ? "text-muted-foreground line-through" : "text-success",
                        )}
                      >
                        {dayRows.length}
                      </span>
                      <span className="mt-1 hidden w-full sm:block">
                        <span className={cn("line-clamp-2 text-[11px] font-medium leading-snug", active ? "text-primary-foreground" : allFull ? "text-muted-foreground line-through" : "text-foreground")}>
                          {formatTripTitle(dayRows[0].trip.title)}
                        </span>
                        {dayRows.length > 1 && (
                          <span className={cn("mt-0.5 block text-[10.5px]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>+{dayRows.length - 1} аялал</span>
                        )}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-muted-foreground" aria-label="Тайлбар">
            <li className="flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-gold" aria-hidden="true" /> Өнөөдөр</li>
            <li className="flex items-center gap-2"><span className="h-4 w-4 rounded border border-border bg-card" aria-hidden="true" /> Хөдлөлттэй өдөр</li>
            <li className="flex items-center gap-2"><span className="h-4 w-4 rounded border border-border bg-secondary/60" aria-hidden="true" /> <span className="line-through">Дүүрсэн</span></li>
          </ul>
        </div>

        <section aria-live="polite" aria-label={selectedDay ? dayTitle(selectedDay) : comingUp.length ? "Ойрын хөдлөлтүүд" : "Энэ сарын хөдлөлтүүд"}>
          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-3">
            <h3 className="text-[15px] font-semibold text-foreground">
              {selectedDay ? dayTitle(selectedDay) : comingUp.length ? "Энэ сард хөдлөлт алга — ойрын хөдлөлтүүд" : "Энэ сарын хөдлөлтүүд"}
            </h3>
            {selectedDay && (
              <button type="button" onClick={() => setParams({ date: null })} className="rounded-sm text-[13px] font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground focus-ring">
                Бүх өдөр
              </button>
            )}
            {comingUp.length > 0 && nextMonthWithDepartures && (
              <button
                type="button"
                onClick={() => setParams({ month: monthOf(nextMonthWithDepartures), date: null })}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm text-[13px] font-semibold text-foreground underline decoration-gold underline-offset-4 focus-ring"
              >
                {monthTitle(monthOf(nextMonthWithDepartures)).replace(/^\d{4} оны /, "")}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {shown.length === 0 ? (
            <div className="py-12 text-center">
              <CalendarX2 className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-foreground">Энэ сард товлосон хөдлөлт алга</p>
              {nextMonthWithDepartures ? (
                <button
                  type="button"
                  onClick={() => setParams({ month: monthOf(nextMonthWithDepartures), date: null })}
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground focus-ring"
                >
                  Дараагийн хөдлөлт: {monthTitle(monthOf(nextMonthWithDepartures))}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <Link href={canonicalPath("/custom-trip")} className="mt-5 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground focus-ring">
                  Захиалгат аялал хүсэх
                </Link>
              )}
            </div>
          ) : (
            <ol className="divide-y divide-border">
              {listed.map((row) => (
                <li key={`${row.trip.id}:${row.departure.id}`}>
                  <Link
                    href={`${canonicalPath(`/trips/${row.trip.slug}`)}?departure=${row.day}`}
                    className="group flex gap-4 py-4 focus-ring"
                  >
                    <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md bg-sand sm:w-20">
                      {row.trip.image && <Image src={row.trip.image} alt="" fill sizes="80px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      {!selectedDay && <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-text">{dayTitle(row.day)}</span>}
                      <span className="mt-0.5 line-clamp-2 block text-[14px] font-semibold leading-snug text-foreground group-hover:underline group-hover:decoration-gold group-hover:underline-offset-4">
                        {formatTripTitle(row.trip.title)}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted-foreground">
                        {formatTripDuration(row.trip.durationDays, row.trip.durationNights) && (
                          <>
                            {formatTripDuration(row.trip.durationDays, row.trip.durationNights)}
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span className={cn("font-medium", !row.open ? "text-destructive" : row.tight ? "text-warning" : "text-success")}>{row.label}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[14px] font-bold tabular-nums text-foreground">{row.price ? formatMnt(row.price) : "Үнэ лавлах"}</span>
                      {row.price && <span className="text-[11px] text-muted-foreground">том хүн</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
          {listed.length < shown.length && (
            <button
              type="button"
              onClick={() => setExpandedKey(listKey)}
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full border border-border bg-card text-[14px] font-semibold text-foreground transition-colors hover:border-foreground/40 focus-ring"
            >
              Бүх {shown.length} хөдлөлтийг харах
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
