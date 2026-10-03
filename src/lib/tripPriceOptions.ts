import type { Departure, Trip } from "@/types/trip";
import { departureDateKey } from "./departureDate.js";

export type PassengerOption = { label: string; ageRange: string; price: number | null };
export type DatePriceOption = {
  hotel: string;
  adult: number | null;
  adultMax: number | null;
  child: number | null;
  infant: number | null;
  passengers: PassengerOption[];
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function price(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function datePriceOptions(trip: Pick<Trip, "sourceMetadata">, departure: Pick<Departure, "startDate">): DatePriceOption[] {
  const groups = trip.sourceMetadata?.price_groups;
  if (!Array.isArray(groups)) return [];
  const day = departureDateKey(departure.startDate);
  return groups.flatMap((value) => {
    const group = object(value);
    const keys = Array.isArray(group.date_keys) ? group.date_keys : Array.isArray(group.dates) ? group.dates : [];
    if (keys.length > 0 && !keys.includes(day)) return [];
    const range = object(group.adult_price_range);
    const passengers = Array.isArray(group.passenger_prices) ? group.passenger_prices : [];
    return [{
      hotel: typeof group.hotel === "string" ? group.hotel.trim() : "",
      adult: price(group.adult_price),
      adultMax: price(range.max),
      child: price(group.child_price),
      infant: price(group.infant_price),
      passengers: passengers.map((item) => {
        const passenger = object(item);
        const baseLabel = String(passenger.label || "Хүүхэд").trim();
        const ageRange = String(passenger.age_range || "").trim();
        return {
          label: ageRange && !baseLabel.includes(ageRange) ? `${baseLabel} ${ageRange}` : baseLabel,
          ageRange,
          price: price(passenger.price),
        };
      }),
    }];
  });
}

export function hasVariablePricing(trip: Pick<Trip, "sourceMetadata">): boolean {
  const groups = trip.sourceMetadata?.price_groups;
  return Array.isArray(groups) && groups.some((value) => {
    const group = object(value);
    const passengers = Array.isArray(group.passenger_prices) ? group.passenger_prices : [];
    return Boolean(group.hotel || group.adult_price_range || passengers.length > 0);
  });
}

export function formatAdultOption(option: DatePriceOption): string {
  if (option.adult == null) return "Үнэ лавлах";
  const amount = (value: number) => `${new Intl.NumberFormat("en-US").format(value)}₮`;
  return option.adultMax && option.adultMax > option.adult
    ? `${amount(option.adult)}–${amount(option.adultMax)}`
    : amount(option.adult);
}
