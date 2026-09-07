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

/**
 * Static Mongolian month labels, deliberately not `Intl`/`toLocaleDateString`.
 *
 * `toLocaleDateString("mn-MN", { month: "short" })` renders correctly on the
 * server (Node ships full ICU data) but a browser's built-in ICU is often
 * reduced and silently falls back to something else instead of throwing —
 * confirmed directly: the server produced "9-р сар", the browser "Sept", for
 * the identical call. React then declares a hydration mismatch and discards
 * the server-rendered tree. A static lookup can never disagree with itself.
 */
const MONTH_SHORT_MN = [
  "1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар",
  "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар",
];
const MONTH_GENITIVE_MN = MONTH_SHORT_MN.map((m) => `${m}ын`);

export function formatMonthShort(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return MONTH_SHORT_MN[date.getMonth()];
}

/** Ordinal month names, for headings like "2026 оны есдүгээр сар". */
const MONTH_ORDINAL_MN = [
  "нэгдүгээр", "хоёрдугаар", "гуравдугаар", "дөрөвдүгээр", "тавдугаар", "зургаадугаар",
  "долдугаар", "наймдугаар", "есдүгээр", "аравдугаар", "арван нэгдүгээр", "арван хоёрдугаар",
];

export function formatYearMonthLong(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()} оны ${MONTH_ORDINAL_MN[date.getMonth()]} сар`;
}

/** "2026 оны 9-р сарын 5" — full date, admin lists and confirmations. */
export function formatFullDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()} оны ${formatDepartureDate(date.toISOString())}`;
}

/** Short "9-р сарын 5" style label used on cards and departure rows. */
export function formatDepartureDate(value: string): string {
  const date = new Date(value);
  return `${MONTH_GENITIVE_MN[date.getMonth()]} ${date.getDate()}`;
}
