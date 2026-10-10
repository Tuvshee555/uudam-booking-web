"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { availability, formatDepartureDate } from "@/lib/departures";
import { departureDateKey } from "@/lib/departureDate";
import type { Departure } from "@/types/trip";
import { cn } from "@/lib/utils";

const weekdays = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

function monthKey(value: string) { return departureDateKey(value).slice(0, 7); }
function shortPrice(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value / 1_000_000);
}

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
  if (!current) return <p className="py-3 text-sm text-muted-foreground">Товлосон огноо алга.</p>;
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
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Явах огноо</h3>
        <div className="flex items-center gap-1 text-sm font-medium">
          <button type="button" title="Өмнөх сар" aria-label="Өмнөх сар" disabled={position === 0}
            onClick={() => setShownMonth(months[position - 1])}
            className="flex h-8 w-8 items-center justify-center disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-24 text-center tabular-nums">{year} · {month}-р сар</span>
          <button type="button" title="Дараагийн сар" aria-label="Дараагийн сар" disabled={position === months.length - 1}
            onClick={() => setShownMonth(months[position + 1])}
            className="flex h-8 w-8 items-center justify-center disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[11px] text-muted-foreground">
        {weekdays.map((day) => <span key={day} className="py-1">{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leading }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const departure = byDay.get(day);
          const seats = departure ? availability(departure) : null;
          const price = departure?.price ?? basePrice;
          const active = departure?.id === selectedId;
          return departure ? (
            <button key={day} type="button" disabled={!seats?.selectable} onClick={() => onSelect(departure)}
              aria-label={`${current}-${String(day).padStart(2, "0")}, ${seats?.label}, эхлэх үнэ ${price.toLocaleString("en-US")} төгрөг`}
              aria-pressed={active}
              className={cn("relative flex h-9 flex-col items-center justify-center rounded-md border text-xs leading-tight transition-colors",
                active ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border bg-secondary/45 hover:border-primary",
                !seats?.selectable && "border-destructive/25 bg-destructive/5 text-destructive")}
            >
              {seats?.tone === "tight" && (
                <span aria-hidden className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />
              )}
              <span className="font-semibold">{day}</span>
              <span className="text-[9px] tabular-nums opacity-80">{!seats?.selectable ? (departure.status === "SOLD_OUT" || departure.seatsLeft === 0 ? "Дүүрсэн" : seats?.label) : price > 0 ? shortPrice(price) : "—"}</span>
            </button>
          ) : <span key={day} className="flex h-9 items-center justify-center text-xs text-muted-foreground/40">{day}</span>;
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Үнэ: сая ₮, нэг том хүний эхлэх үнэ.</p>
      {hasTight && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span aria-hidden className="h-2 w-2 rounded-full bg-destructive" />
          Цөөн суудалтай өдөр
        </p>
      )}
      {selected && selectedSeats?.tone === "tight" && (
        <p role="status" className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
          {formatDepartureDate(selected.startDate)} — цөөн суудал үлдсэн. Захиалгаа түргэн баталгаажуулаарай.
        </p>
      )}
    </div>
  );
}
