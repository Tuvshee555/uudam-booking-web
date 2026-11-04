import { departureDateKey } from "./departureDate.js";

type EditableDeparture = { startDate: string | Date; status: string };
type EditableTrip<D extends EditableDeparture> = { departures: D[]; sourceMetadata: Record<string, unknown> | null };

function groupDates(metadata: Record<string, unknown> | null): Set<string> {
  const groups = Array.isArray(metadata?.price_groups) ? metadata.price_groups : [];
  const dates = new Set<string>();
  for (const value of groups) {
    const group = value && typeof value === "object" ? value as Record<string, unknown> : {};
    for (const key of ["dates", "date_keys", "display_dates"]) {
      for (const entry of Array.isArray(group[key]) ? group[key] as unknown[] : []) {
        const iso = String(entry).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
        if (iso) dates.add(iso);
      }
    }
  }
  return dates;
}

/**
 * The departures the trip editor lists.
 *
 * A date removed in the editor (or by the chatbot) is not deleted: its row is
 * kept as CANCELLED so bookings keep their history, and its fare entry is
 * dropped. Loading every row back into the editor made such a date reappear
 * after every refresh, so "removing" a date looked like it never saved.
 *
 * A cancelled date that still has a fare entry was cancelled on purpose with
 * the status control, and stays listed so staff can reopen it.
 */
export function editableDepartures<D extends EditableDeparture>(trip: EditableTrip<D>): D[] {
  const priced = groupDates(trip.sourceMetadata);
  return trip.departures.filter((departure) => departure.status !== "CANCELLED" || priced.has(departureDateKey(departure.startDate)));
}
