"use client";

import { useState } from "react";

import type { Trip } from "@/types/trip";
import { hasKnownTripPrice } from "@/lib/pricing";
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
}: {
  trip: Trip;
  bankDetails?: string | null;
}) {
  const hasPrice = hasKnownTripPrice(trip.price);
  const [selectedMode, setSelectedMode] = useState<Mode>("book");
  const mode = hasPrice ? selectedMode : "ask";

  return (
    <div>
      {hasPrice && (
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
          <button
            type="button"
            onClick={() => setSelectedMode("book")}
            className={cn(
              "rounded-lg py-2 text-sm font-semibold transition-colors",
              mode === "book" ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
            )}
          >
            Онлайн захиалах
          </button>
          <button
            type="button"
            onClick={() => setSelectedMode("ask")}
            className={cn(
              "rounded-lg py-2 text-sm font-semibold transition-colors",
              mode === "ask" ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
            )}
          >
            Ажилтнаар холбогдох
          </button>
        </div>
      )}

      {hasPrice && mode === "book" ? (
        <BookingPanel trip={trip} bankDetails={bankDetails} />
      ) : (
        <EnquiryPanel trip={trip} />
      )}
    </div>
  );
}
