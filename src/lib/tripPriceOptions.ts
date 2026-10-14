import type { Departure, Trip } from "@/types/trip";
import { departureDateKey } from "./departureDate.js";

export type PassengerOption = { label: string; ageRange: string; price: number | null };
export type DatePriceOption = {
  key: string;
  label: string;
  hotel: string;
  packageId: string;
  packageNote: string;
  adult: number | null;
  adultMax: number | null;
  child: number | null;
  infant: number | null;
  passengers: PassengerOption[];
};

export type PriceDimensionOption = {
  id: string;
  label: string;
  optionKey: string;
  adult: number | null;
  delta: number | null;
  isCheapest: boolean;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function price(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function defaultPackageNote(packageId: string): string {
  if (/чөлөөт/i.test(packageId)) return "Хөтөлбөргүй, илүү чөлөөтэй багц. Нислэг, буудал болон үндсэн үйлчилгээтэй.";
  if (/хөтөлбөр/i.test(packageId)) return "Өдөр тутмын хөтөлбөр, үзвэр үйлчилгээтэй багц.";
  return "";
}

export function datePriceOptions(trip: Pick<Trip, "sourceMetadata">, departure: Pick<Departure, "startDate">): DatePriceOption[] {
  const groups = trip.sourceMetadata?.price_groups;
  if (!Array.isArray(groups)) return [];
  const ageRules = object(trip.sourceMetadata?.age_rules);
  const packageOptions = Array.isArray(trip.sourceMetadata?.package_options)
    ? trip.sourceMetadata.package_options.map(object) : [];
  const ageRule = (kind: "child" | "infant") =>
    typeof ageRules[kind] === "string" ? ageRules[kind].trim() : "";
  const day = departureDateKey(departure.startDate);
  return groups.flatMap((value) => {
    const group = object(value);
    const keys = Array.isArray(group.date_keys) ? group.date_keys : Array.isArray(group.dates) ? group.dates : [];
    if (keys.length > 0 && !keys.includes(day)) return [];
    const range = object(group.adult_price_range);
    const passengers = Array.isArray(group.passenger_prices) ? group.passenger_prices : [];
    const hotel = typeof group.hotel === "string" ? group.hotel.trim() : "";
    const packageId = typeof group.package_id === "string" ? group.package_id.trim() : "";
    const label = hotel || packageId || String(group.label || "").trim();
    const packageOption = packageOptions.find((item) =>
      [text(item.id), text(item.label)].filter(Boolean).includes(packageId));
    const packageNote = text(packageOption?.note) || defaultPackageNote(packageId);
    const passengerOptions = passengers.map((item) => {
      const passenger = object(item);
      const baseLabel = String(passenger.label || "Хүүхэд").trim();
      const ageRange = String(passenger.age_range || "").trim();
      return {
        label: ageRange && !baseLabel.includes(ageRange) ? `${baseLabel} ${ageRange}` : baseLabel,
        ageRange,
        price: price(passenger.price),
      };
    });
    const hasPassenger = (pattern: RegExp) => passengerOptions.some((item) => pattern.test(item.label));
    const childPrice = price(group.child_price);
    const infantPrice = price(group.infant_price);
    if (childPrice != null && !hasPassenger(/хүүхэд|child/i)) {
      const ageRange = String(group.child_age || ageRule("child")).trim();
      passengerOptions.push({ label: ageRange ? `Хүүхэд ${ageRange}` : "Хүүхэд", ageRange, price: childPrice });
    }
    if (infantPrice != null && !hasPassenger(/нярай|infant/i)) {
      const ageRange = String(group.infant_age || ageRule("infant")).trim();
      passengerOptions.push({ label: ageRange ? `Нярай ${ageRange}` : "Нярай", ageRange, price: infantPrice });
    }
    return [{
      key: `${hotel}|${packageId}|${String(group.label || "")}`,
      label,
      hotel,
      packageId,
      packageNote,
      adult: price(group.adult_price),
      adultMax: price(range.max),
      child: childPrice,
      infant: infantPrice,
      passengers: passengerOptions,
    }];
  });
}

export function hasVariablePricing(trip: Pick<Trip, "sourceMetadata">): boolean {
  const groups = trip.sourceMetadata?.price_groups;
  return Array.isArray(groups) && groups.some((value) => {
    const group = object(value);
    const passengers = Array.isArray(group.passenger_prices) ? group.passenger_prices : [];
    return Boolean(group.hotel || group.package_id || group.adult_price_range || passengers.length > 0);
  });
}

export function formatAdultOption(option: DatePriceOption): string {
  if (option.adult == null) return "Үнэ лавлах";
  const amount = (value: number) => `${new Intl.NumberFormat("en-US").format(value)}₮`;
  return option.adultMax && option.adultMax > option.adult
    ? `${amount(option.adult)}–${amount(option.adultMax)}`
    : amount(option.adult);
}

/**
 * Build one independent selector (package or hotel) from the flattened fare
 * rows stored in price_groups. The opposite dimension is kept fixed so
 * changing the package keeps the hotel, and changing the hotel keeps the
 * package.
 */
export function priceDimensionOptions(
  options: DatePriceOption[],
  dimension: "package" | "hotel",
  selected: DatePriceOption | null,
): PriceDimensionOption[] {
  const idOf = (option: DatePriceOption) => dimension === "package" ? option.packageId : option.hotel;
  const oppositeOf = (option: DatePriceOption) => dimension === "package" ? option.hotel : option.packageId;
  const selectedOpposite = selected ? oppositeOf(selected) : "";
  const matching = options.filter((option) => idOf(option) && (!selectedOpposite || oppositeOf(option) === selectedOpposite));
  const unique = new Map<string, DatePriceOption>();
  for (const option of matching) {
    const id = idOf(option);
    const previous = unique.get(id);
    if (!previous || (option.adult ?? Number.POSITIVE_INFINITY) < (previous.adult ?? Number.POSITIVE_INFINITY)) {
      unique.set(id, option);
    }
  }
  const values = [...unique.values()];
  const cheapest = values.reduce<number | null>((minimum, option) => {
    if (option.adult == null) return minimum;
    return minimum == null ? option.adult : Math.min(minimum, option.adult);
  }, null);
  const result = values.map((option) => {
    const id = idOf(option);
    const delta = cheapest == null || option.adult == null ? null : option.adult - cheapest;
    return {
      id,
      label: id,
      optionKey: option.key,
      adult: option.adult,
      delta,
      isCheapest: delta === 0,
    };
  });
  if (dimension === "package") {
    const rank = (label: string) => /хөтөлбөртэй/i.test(label) && !/гүй/i.test(label) ? 0 : /хөтөлбөргүй/i.test(label) ? 1 : 2;
    return result.sort((a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label, "mn"));
  }
  return result.sort((a, b) => (a.adult ?? Number.POSITIVE_INFINITY) - (b.adult ?? Number.POSITIVE_INFINITY));
}

export function formatPriceDelta(option: PriceDimensionOption): string {
  if (option.isCheapest) return "Хамгийн хямд";
  if (option.delta == null) return "Үнэ лавлах";
  return `+${new Intl.NumberFormat("en-US").format(option.delta)}₮`;
}
