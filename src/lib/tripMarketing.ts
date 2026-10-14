import type { Departure, Trip } from "@/types/trip";

type MarketingBadge = {
  saleEnabled: boolean;
  saleLabel: string;
  saleEndsAt: string | null;
  seatsPercentLeft: number | null;
  seatsLeft: number | null;
  seatsTotal: number | null;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function percentOrNull(value: unknown): number | null {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.max(0, Math.min(100, Math.trunc(parsed)));
}

export function marketingBadgeFor(trip: Trip): MarketingBadge {
  const metadata = record(trip.sourceMetadata);
  const connectedSource = record(metadata.connectedSource);
  const direct = record(metadata.marketingBadge);
  const connected = record(connectedSource.marketingBadge);
  const legacy = record(metadata.marketing_badge);

  const saleLabel =
    stringOrNull(direct.saleLabel) ??
    stringOrNull(connected.saleLabel) ??
    stringOrNull(legacy.sale_label) ??
    "ХЯМДРАЛ";

  const endsAt = [direct.saleEndsAt, connected.saleEndsAt, legacy.sale_ends_at]
    .find((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));

  return {
    saleEnabled:
      direct.saleEnabled === true ||
      connected.saleEnabled === true ||
      legacy.sale_enabled === true,
    saleLabel,
    saleEndsAt: endsAt ?? null,
    seatsPercentLeft:
      percentOrNull(direct.seatsPercentLeft) ??
      percentOrNull(connected.seatsPercentLeft) ??
      percentOrNull(legacy.seats_percent_left),
    seatsLeft:
      numberOrNull(direct.seatsLeft) ??
      numberOrNull(connected.seatsLeft) ??
      numberOrNull(legacy.seats_left) ??
      numberOrNull(metadata.seats_left),
    seatsTotal:
      numberOrNull(direct.seatsTotal) ??
      numberOrNull(connected.seatsTotal) ??
      numberOrNull(legacy.seats_total) ??
      numberOrNull(metadata.seats_total),
  };
}

/** The sale's last day counts: it is over only once the Ulaanbaatar date is past it. */
function saleHasEnded(endsAt: string | null, now: Date): boolean {
  if (!endsAt) return false;
  return endsAt < now.toLocaleDateString("en-CA", { timeZone: "Asia/Ulaanbaatar" });
}

export function saleBadgeLabel(trip: Trip, now: Date = new Date()): string | null {
  const badge = marketingBadgeFor(trip);
  if (badge.saleEnabled && !saleHasEnded(badge.saleEndsAt, now)) return badge.saleLabel;
  return typeof trip.discount === "number" && trip.discount > 0 ? `-${trip.discount}%` : null;
}

export function isSaleTrip(trip: Trip): boolean {
  return saleBadgeLabel(trip) !== null;
}

export function seatCountLabel(left: number | null, total?: number | null): string | null {
  if (left === null) return null;
  if (left <= 0) return "Суудал дүүрсэн";
  if (typeof total === "number" && Number.isFinite(total) && total > 0) {
    return `${left}/${total} суудал үлдсэн`;
  }
  return `${left} суудал үлдсэн`;
}

export function isSoldOutDeparture(departure: Departure | null | undefined): boolean {
  return Boolean(
    departure &&
      (departure.status === "SOLD_OUT" ||
        (typeof departure.seatsLeft === "number" && departure.seatsLeft <= 0)),
  );
}

export function departureSeatFact(departure: Departure): string | null {
  return seatCountLabel(departure.seatsLeft, departure.seatsTotal);
}
