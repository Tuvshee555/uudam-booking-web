"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { availability, formatDepartureDate } from "@/lib/departures";
import { departureDateKey } from "@/lib/departureDate";
import { dayTitle, monthTitle, WEEKDAYS_MN } from "@/lib/calendar";
import type { Departure } from "@/types/trip";
import { cn } from "@/lib/utils";

function monthKey(value: string) { return departureDateKey(value).slice(0, 7); }
function shortPrice(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value / 1_000_000);
}

/**
 * The trip's own departure calendar: only months with a date, each date with
 * its price in millions, full dates struck through and unselectable.
 */
export default function DepartureDatePicker({
  departures,
  selectedId,
  onSelect,
  basePrice,
}: {
  departures: Departure[];
  selectedId: string | null;
  onSelect: (departure: Departure) => void;
  basePrice: number;
}) {
  const months = [...new Set(departures.map((departure) => monthKey(departure.startDate)))].sort();
  const selected = departures.find((departure) => departure.id === selectedId);
  const [shownMonth, setShownMonth] = useState(() => selected ? monthKey(selected.startDate) : months[0] || "");
  const current = months.includes(shownMonth) ? shownMonth : months[0];
  if (!current) {
    return (
      <p className="rounded-lg bg-secondary/70 p-4 text-[13px] leading-relaxed text-muted-foreground">
        Энэ аялалд одоогоор товлосон огноо алга. Хүссэн огноогоо ажилтанд хэлээрэй — боломжтой огноог тодруулж өгнө.
      </p>
    );
  }
  const position = months.indexOf(current);
  const [year, month] = current.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  // "Few seats" is shown on the one date it is true for: a dot on that day, a
  // legend, and a note once that date is picked. Nothing about it is said for
  // the trip as a whole.
  const selectedSeats = selected ? availability(selected) : null;
  const hasTight = departures.some((departure) => availability(departure).tone === "tight");
  const byDay = new Map(departures.filter((departure) => monthKey(departure.startDate) === current)
    .map((departure) => [Number(departureDateKey(departure.startDate).slice(8, 10)), departure]));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-foreground">Явах огноо</h3>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Өмнөх сар" disabled={position === 0}
            onClick={() => setShownMonth(months[position - 1])}
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-secondary focus-ring disabled:opacity-30"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
          <span className="min-w-[8.5rem] text-center text-[13px] font-semibold tabular-nums text-foreground" aria-live="polite">{monthTitle(current)}</span>
          <button type="button" aria-label="Дараагийн сар" disabled={position === months.length - 1}
            onClick={() => setShownMonth(months[position + 1])}
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-secondary focus-ring disabled:opacity-30"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground" aria-hidden="true">
        {WEEKDAYS_MN.map((day) => <span key={day} className="py-1">{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leading }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const departure = byDay.get(day);
          const seats = departure ? availability(departure) : null;
          const price = departure?.price ?? basePrice;
          const active = departure?.id === selectedId;
          const full = departure && !seats?.selectable;
          return departure ? (
            <button key={day} type="button" disabled={!seats?.selectable} onClick={() => onSelect(departure)}
              aria-pressed={active}
              className={cn("relative flex h-11 flex-col items-center justify-center rounded-lg border text-[12px] leading-tight transition-colors focus-ring",
                active ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border bg-card text-foreground hover:border-foreground/40",
                full && "cursor-not-allowed border-transparent bg-secondary/60 text-muted-foreground line-through hover:border-transparent")}
            >
              {seats?.tone === "tight" && (
                <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-warning" />
              )}
              <span className="font-semibold">{day}</span>
              <span className={cn("text-[9.5px] tabular-nums", active ? "text-primary-foreground/85" : "text-muted-foreground")}>
                {full ? "Дүүрсэн" : price > 0 ? shortPrice(price) : "—"}
              </span>
              {/* The spoken name keeps the visible day and adds what the cell abbreviates. */}
              <span className="sr-only">
                {`, ${dayTitle(`${current}-${String(day).padStart(2, "0")}`)}, ${seats?.label}${price > 0 ? `, нэг том хүн ${price.toLocaleString("en-US")}₮` : ""}`}
              </span>
            </button>
          ) : <span key={day} className="flex h-11 items-center justify-center text-[12px] text-muted-foreground/45">{day}</span>;
        })}
      </div>
      <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
        <span>Үнэ: сая ₮, нэг том хүн</span>
        {hasTight && (
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warning" /> Цөөн суудалтай</span>
        )}
      </p>
      {selected && selectedSeats?.tone === "tight" && (
        <p role="status" className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-[12.5px] font-semibold text-warning">
          {formatDepartureDate(selected.startDate)} — цөөн суудал үлдсэн.
        </p>
      )}
    </div>
  );
}
