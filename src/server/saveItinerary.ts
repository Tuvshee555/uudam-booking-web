import type { Prisma } from "@prisma/client";
import type { ItineraryInput } from "./tripInput";

/** Negative day numbers archive removed rows without deleting their IDs/content. */
export async function saveItinerary(tx: Prisma.TransactionClient, tripId: string, days: ItineraryInput[]) {
  const current = (await tx.itineraryDay.findMany({ where: { tripId } })).map((day) => ({ ...day }));
  const ids = days.flatMap((day) => day.id ? [day.id] : []);
  if (new Set(ids).size !== ids.length || ids.some((id) => !current.some((row) => row.id === id))) {
    throw new Error("Invalid or duplicate itinerary ID");
  }
  let archivedNumber = Math.min(0, ...current.map((day) => day.dayNumber)) - 1;
  // Free positive positions before reordering, preserving the unique constraint.
  for (const row of current.filter((day) => day.dayNumber > 0)) {
    await tx.itineraryDay.update({ where: { id: row.id }, data: { dayNumber: archivedNumber-- } });
  }
  const used = new Set<string>();
  for (const day of days) {
    const { id, ...data } = day;
    const old = id ? current.find((row) => row.id === id)
      : current.find((row) => row.dayNumber === day.dayNumber && !used.has(row.id) && !ids.includes(row.id));
    if (old) {
      used.add(old.id);
      await tx.itineraryDay.update({ where: { id: old.id }, data });
    } else {
      await tx.itineraryDay.create({ data: { ...data, tripId } });
    }
  }
  return current.filter((day) => day.dayNumber > 0 && !used.has(day.id));
}
