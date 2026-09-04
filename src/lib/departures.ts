import type { Departure, DepartureStatus, Trip } from "@/types/trip";

/**
 * Shared departure logic. Three files previously carried their own copy of
 * "upcoming, not cancelled, not departed" — the trip card, the catalogue's
 * soonest-first sort and the enquiry panel — and they had already drifted on
 * which statuses count. One source of truth instead.
 */

/** Still sellable: in the future, and not called off or already gone. */
export function isUpcoming(departure: Departure, now = Date.now()): boolean {
  return (
    new Date(departure.startDate).getTime() >= now &&
    departure.status !== "CANCELLED" &&
    departure.status !== "DEPARTED"
  );
}

/** Upcoming departures, soonest first. */
export function upcomingDepartures(trip: Trip, now = Date.now()): Departure[] {
  return trip.departures
    .filter((departure) => isUpcoming(departure, now))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

export function nextDeparture(trip: Trip, now = Date.now()): Departure | null {
  return upcomingDepartures(trip, now)[0] ?? null;
}

/** Sort key for "soonest departure"; trips with no date sink to the bottom. */
export function soonestDepartureTime(trip: Trip, now = Date.now()): number {
  const next = nextDeparture(trip, now);
  return next ? new Date(next.startDate).getTime() : Number.POSITIVE_INFINITY;
}

export type AvailabilityTone = "open" | "tight" | "closed";

export type Availability = {
  label: string;
  tone: AvailabilityTone;
  /** False for statuses a visitor cannot enquire about. */
  selectable: boolean;
};

/**
 * Deliberately categorical rather than an exact "3 суудал үлдсэн".
 *
 * `seatsLeft` is typed in by staff and never decremented by the system —
 * bookings are closed on the phone and in Messenger. Publishing a precise
 * number that nobody updates after each sale is a promise the site cannot
 * keep, and on a ₮3-14m purchase a stale count costs more trust than the
 * urgency wins. Status carries the same signal honestly.
 */
export function availability(departure: Departure): Availability {
  const status: DepartureStatus = departure.status;

  if (status === "CANCELLED") {
    return { label: "Цуцлагдсан", tone: "closed", selectable: false };
  }
  if (status === "DEPARTED") {
    return { label: "Хөдөлсөн", tone: "closed", selectable: false };
  }
  if (status === "SOLD_OUT") {
    return { label: "Дүүрсэн", tone: "closed", selectable: false };
  }
  if (status === "ALMOST_FULL") {
    return { label: "Цөөн суудал", tone: "tight", selectable: true };
  }

  // OPEN. Staff may still have flagged a low seat count without moving the
  // status, so treat a small number as the same "few places" signal.
  const seatsLeft = departure.seatsLeft;
  if (seatsLeft !== null && seatsLeft <= 0) {
    return { label: "Дүүрсэн", tone: "closed", selectable: false };
  }
  if (seatsLeft !== null && seatsLeft <= 5) {
    return { label: "Цөөн суудал", tone: "tight", selectable: true };
  }

  return { label: "Захиалга нээлттэй", tone: "open", selectable: true };
}

/** Short "12-р сарын 5" style label used on cards and departure rows. */
export function formatDepartureDate(value: string): string {
  return new Date(value).toLocaleDateString("mn-MN", {
    month: "short",
    day: "numeric",
  });
}
