import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { syncTripToChatbot, deleteTripFromChatbot } from "./chatbotTripSync";
import { TRIP_INCLUDE } from "./tripInput";

type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
function snapshot(value: unknown) {
  const trip = JSON.parse(JSON.stringify(value)) as Row;
  const metadata = { ...record(trip.sourceMetadata) };
  delete metadata.websiteSyncPending;
  trip.sourceMetadata = metadata;
  return trip;
}

/** The delivery payload is committed with the website edit, before any HTTP call. */
export async function queueTripSync(tx: Prisma.TransactionClient, trip: { id: string; sourceMetadata: unknown }, previous?: unknown, archive = false) {
  const metadata = record(trip.sourceMetadata);
  const pending = record(metadata.websiteSyncPending);
  return tx.trip.update({ where: { id: trip.id }, data: { sourceMetadata: {
    ...metadata,
    websiteSyncPending: {
      id: randomUUID(), trip: snapshot(trip),
      previousTrip: pending.previousTrip || (previous ? snapshot(previous) : null),
      archive, queuedAt: new Date().toISOString(),
    },
  } as Prisma.InputJsonValue }, include: TRIP_INCLUDE });
}

export async function deliverTripSync(id: string): Promise<boolean> {
  const trip = await prisma.trip.findUnique({ where: { id } });
  const pending = record(record(trip?.sourceMetadata).websiteSyncPending);
  if (typeof pending.id !== "string") return true;
  try {
    if (pending.archive) await deleteTripFromChatbot(typeof record(pending.trip).sourceTripId === "string" ? record(pending.trip).sourceTripId as string : null);
    else await syncTripToChatbot(pending.trip, pending.previousTrip);
    // An older delivery must never acknowledge a newer edit's pending payload.
    const acknowledged = await prisma.$executeRaw`UPDATE "Trip"
      SET "sourceMetadata"="sourceMetadata" - 'websiteSyncPending' - 'canonicalExtraPatch'
      WHERE id=${id} AND "sourceMetadata"->'websiteSyncPending'->>'id'=${pending.id}`;
    return acknowledged > 0;
  } catch {
    console.error("Trip sync remains queued", id);
    return false;
  }
}
