import type { Departure, Trip } from "@/types/trip";
import { availability, upcomingDepartures } from "./departures";

/**
 * What a card or a trip header can truthfully say about booking a trip:
 * the next date that is still open, that every upcoming date is full, or
 * that no date is scheduled (staff arrange one on request).
 */
export type TripStatus =
  | { kind: "open"; departure: Departure; tight: boolean; openCount: number }
  | { kind: "full" }
  | { kind: "no-dates" };

export function tripStatus(trip: Pick<Trip, "departures">, now: number = Date.now()): TripStatus {
  const upcoming = upcomingDepartures(trip as Trip, now);
  const open = upcoming.filter((departure) => availability(departure).selectable);
  if (open.length) {
    return { kind: "open", departure: open[0], tight: availability(open[0]).tone === "tight", openCount: open.length };
  }
  return upcoming.length ? { kind: "full" } : { kind: "no-dates" };
}
