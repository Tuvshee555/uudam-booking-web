import type { Departure, Trip } from "@/types/trip";

type MarketingBadge = {
  saleEnabled: boolean;
  saleLabel: string;
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

  return {
    saleEnabled:
      direct.saleEnabled === true ||
      connected.saleEnabled === true ||
      legacy.sale_enabled === true,
    saleLabel,
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

export function saleBadgeLabel(trip: Trip): string | null {
  const badge = marketingBadgeFor(trip);
  if (badge.saleEnabled) return badge.saleLabel;
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

export function marketingSeatFacts(trip: Trip): string[] {
  const badge = marketingBadgeFor(trip);
  const facts = [
    badge.seatsPercentLeft !== null ? `${badge.seatsPercentLeft}% суудал үлдсэн` : null,
    seatCountLabel(badge.seatsLeft, badge.seatsTotal),
  ].filter((value): value is string => Boolean(value));
  return [...new Set(facts)];
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
