"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { availability } from "@/lib/departures";
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
              className={cn("flex h-12 flex-col items-center justify-center rounded-md border text-xs leading-tight transition-colors",
                active ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border bg-secondary/45 hover:border-primary",
                !seats?.selectable && "border-destructive/25 bg-destructive/5 text-destructive")}
            >
              <span className="font-semibold">{day}</span>
              <span className="mt-0.5 text-[10px] tabular-nums opacity-80">{!seats?.selectable ? (departure.status === "SOLD_OUT" || departure.seatsLeft === 0 ? "Дүүрсэн" : seats?.label) : price > 0 ? shortPrice(price) : "—"}</span>
            </button>
          ) : <span key={day} className="flex h-12 items-center justify-center text-xs text-muted-foreground/50">{day}</span>;
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Үнэ: сая ₮, нэг том хүний эхлэх үнэ.</p>
    </div>
  );
}
