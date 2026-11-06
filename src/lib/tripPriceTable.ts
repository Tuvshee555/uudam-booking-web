import type { Departure, Trip } from "@/types/trip";
import { availability } from "./departures";
import { departureDateKey } from "./departureDate.js";
import { datePriceOptions, isRealFare, type DatePriceOption } from "./tripPriceOptions";

/**
 * The per-date price table for a trip sold by hotel and/or package.
 *
 * Every bookable departure gets its own hotel × package rows, each with the
 * adult fare and the trip's child and infant bands. Departures whose rows are
 * identical are shown as one block ("11-р сарын 11, 18, 25"), so a weekly
 * trip with a few price seasons reads as a few short tables, not sixty rows.
 */

/**
 * One child/infant column. `key` is the band's PassengerOption.key (label, age
 * range and condition, "#2" for a repeat), so two bands that differ only by a
 * height or bed condition are two columns, and a row's fare is found by key.
 */
export type PriceTableBand = { key: string; label: string; ageRange: string; condition: string };

export type PriceTableBlock = {
  key: string;
  /** Ulaanbaatar day keys of the departures in this block, ascending. */
  days: string[];
  rows: DatePriceOption[];
  /** Every child/infant band any row in the block prices, in the order rows list them. */
  bands: PriceTableBand[];
  showHotel: boolean;
  showPackage: boolean;
  showSingle: boolean;
  /** The cheapest bookable, published adult fare in the block, for the collapsed heading. */
  fromAdult: number | null;
};

function rowSignature(row: DatePriceOption): unknown[] {
  return [
    row.hotel, row.packageId, row.rowLabel, row.note, row.available,
    row.adult, row.adultMax, row.singleSupplement,
    row.passengers.map((band) => [band.key, band.label, band.price, band.priceMax, band.free]),
  ];
}

function orderRows(rows: DatePriceOption[], packageOrder: string[]): DatePriceOption[] {
  const cheapestByHotel = new Map<string, number>();
  for (const row of rows) {
    const value = row.adult ?? Number.POSITIVE_INFINITY;
    cheapestByHotel.set(row.hotel, Math.min(cheapestByHotel.get(row.hotel) ?? Number.POSITIVE_INFINITY, value));
  }
  const packageRank = (id: string) => {
    const index = packageOrder.indexOf(id);
    return index < 0 ? packageOrder.length : index;
  };
  return [...rows].sort((a, b) =>
    (cheapestByHotel.get(a.hotel) ?? 0) - (cheapestByHotel.get(b.hotel) ?? 0)
    || a.hotel.localeCompare(b.hotel, "mn")
    || packageRank(a.packageId) - packageRank(b.packageId)
    || (a.adult ?? Number.POSITIVE_INFINITY) - (b.adult ?? Number.POSITIVE_INFINITY));
}

export function priceTableBlocks(trip: Pick<Trip, "sourceMetadata">, departures: Departure[]): PriceTableBlock[] {
  const packageOrder = (Array.isArray(trip.sourceMetadata?.package_options) ? trip.sourceMetadata.package_options : [])
    .map((option) => option && typeof option === "object" ? String((option as Record<string, unknown>).id ?? (option as Record<string, unknown>).label ?? "").trim() : "");
  const blocks = new Map<string, PriceTableBlock>();
  const seenDays = new Set<string>();
  for (const departure of departures) {
    if (!availability(departure).selectable) continue;
    const day = departureDateKey(departure.startDate);
    if (seenDays.has(day)) continue;
    const rows = orderRows(datePriceOptions(trip, departure, { includeUnavailable: true }), packageOrder);
    if (!rows.length) continue;
    seenDays.add(day);
    const signature = JSON.stringify(rows.map(rowSignature));
    const block = blocks.get(signature);
    if (block) {
      block.days.push(day);
      continue;
    }
    const bands: PriceTableBand[] = [];
    for (const row of rows) {
      for (const band of row.passengers) {
        if (!bands.some((entry) => entry.key === band.key)) {
          bands.push({ key: band.key, label: band.label, ageRange: band.ageRange, condition: band.condition });
        }
      }
    }
    // Only a real published fare: a 0₮ or 1₮ placeholder never becomes the "from" price.
    const bookable = rows.flatMap((row) => row.available && isRealFare(row.adult) ? [row.adult] : []);
    blocks.set(signature, {
      key: day,
      days: [day],
      rows,
      bands,
      showHotel: rows.some((row) => row.hotel),
      showPackage: rows.some((row) => row.packageId),
      showSingle: rows.some((row) => row.singleSupplement != null && row.singleSupplement > 0),
      fromAdult: bookable.length ? Math.min(...bookable) : null,
    });
  }
  return [...blocks.values()]
    .map((block) => ({ ...block, days: [...block.days].sort() }))
    .sort((a, b) => a.days[0].localeCompare(b.days[0]));
}

/**
 * "11-р сарын 11, 18, 25 · 12-р сарын 2" — the block's dates by month. A year
 * other than `currentYear` is named ("2027 оны 1-р сарын 6").
 */
export function formatDayList(days: string[], currentYear: number): string {
  const months: Array<{ year: number; month: number; dates: number[] }> = [];
  for (const day of [...days].sort()) {
    const [year, month, date] = day.split("-").map(Number);
    const last = months[months.length - 1];
    if (last && last.year === year && last.month === month) last.dates.push(date);
    else months.push({ year, month, dates: [date] });
  }
  return months
    .map(({ year, month, dates }) => `${year !== currentYear ? `${year} оны ` : ""}${month}-р сарын ${dates.join(", ")}`)
    .join(" · ");
}

/** The block a departure day belongs to, if any. */
export function blockForDay(blocks: PriceTableBlock[], day: string | undefined): PriceTableBlock | null {
  return day ? blocks.find((block) => block.days.includes(day)) ?? null : null;
}
