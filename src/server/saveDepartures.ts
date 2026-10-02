import type { Prisma } from "@prisma/client";
import type { DepartureInput } from "./tripInput";
import { departureDateKey } from "../lib/departureDate.js";

export async function saveDepartures(tx: Prisma.TransactionClient, tripId: string, departures: DepartureInput[]) {
  const current = await tx.departure.findMany({ where: { tripId } });
  const keepIds: string[] = [];
  for (const departure of departures) {
    const old = current.find((row) => departureDateKey(row.startDate) === departureDateKey(departure.startDate));
    const saved = old
      ? await tx.departure.update({ where: { id: old.id }, data: departure })
      : await tx.departure.create({ data: { ...departure, tripId } });
    keepIds.push(saved.id);
  }
  // Keep referenced historical dates while closing them to new bookings.
  await tx.departure.updateMany({
    where: { tripId, id: { notIn: keepIds } }, data: { status: "CANCELLED" },
  });
  await tx.departure.deleteMany({
    where: { tripId, id: { notIn: keepIds }, bookings: { none: {} }, enquiries: { none: {} } },
  });
}
