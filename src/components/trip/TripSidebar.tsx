"use client";

import { useState } from "react";

import type { Trip } from "@/types/trip";
import { hasKnownTripPrice } from "@/lib/pricing";
import { hasVariablePricing } from "@/lib/tripPriceOptions";
import { cn } from "@/lib/utils";

import BookingPanel from "./BookingPanel";
import EnquiryPanel from "./EnquiryPanel";

type Mode = "book" | "ask";

/**
 * Two ways to secure a seat, kept side by side rather than one replacing the
 * other: online booking is new, but most customers here still want a person
 * on the phone, and forcing them through a checkout form to get that would
 * cost the agency the sale it already knew how to close.
 */
export default function TripSidebar({
  trip,
  bankDetails,
  selectedDate,
  onDepartureChange,
}: {
  trip: Trip;
  bankDetails?: string | null;
  selectedDate?: string;
  onDepartureChange: (date: string) => void;
}) {
  const hasPrice = hasKnownTripPrice(trip.price);
  const variablePricing = hasVariablePricing(trip);
  const [selectedMode, setSelectedMode] = useState<Mode>("book");
  const [selection, setSelection] = useState<{ departureId: string; message: string; adults: number; children: number; infants: number } | null>(null);
  const mode = hasPrice ? selectedMode : "ask";

  return (
    <div>
      {hasPrice && (
        <div role="tablist" aria-label="Захиалах арга" className="mb-3 grid grid-cols-2 gap-1 rounded-full border border-border bg-card p-1">
          {([
            { key: "book", label: variablePricing ? "Үнэ сонгох" : "Онлайн захиалах" },
            { key: "ask", label: "Ажилтанд асуух" },
          ] as const).map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={mode === entry.key}
              onClick={() => setSelectedMode(entry.key)}
              className={cn(
                "h-10 rounded-full text-[13.5px] font-semibold transition-colors focus-ring",
                mode === entry.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}

      {hasPrice && mode === "book" ? (
        <BookingPanel trip={trip} bankDetails={bankDetails} selectedDate={selectedDate} onDepartureChange={onDepartureChange} onAsk={(next) => { setSelection(next); setSelectedMode("ask"); }} />
      ) : (
        <EnquiryPanel trip={trip} initialSelection={selection} variablePricing={variablePricing} selectedDate={selectedDate} onDepartureChange={onDepartureChange} />
      )}
    </div>
  );
}
