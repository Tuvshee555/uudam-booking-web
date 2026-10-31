import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { syncTripToChatbot, deleteTripFromChatbot, ChatbotSyncError, type ChatbotSyncReport } from "./chatbotTripSync";
import { TRIP_INCLUDE } from "./tripInput";
import { deliveryPayload, foldSave, pendingEdits, retryDelayMinutes, syncSnapshot } from "@/lib/tripSyncEdits";

type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};

/**
 * The delivery payload is committed with the website edit, before any HTTP
 * call. Each edited field keeps the value staff replaced as its baseline (see
 * tripSyncEdits.ts for why a whole-trip baseline lost a title on 2026-10-16).
 */
export async function queueTripSync(tx: Prisma.TransactionClient, trip: { id: string; sourceMetadata: unknown }, previous?: unknown, archive = false) {
  const metadata = record(trip.sourceMetadata);
  const pending = record(metadata.websiteSyncPending);
  const next = syncSnapshot(trip);
  const created = !previous && !Object.keys(pending).length;
  const edits = previous ? foldSave(pending, syncSnapshot(previous), next) : pendingEdits(pending);
  const history = Array.isArray(pending.history) ? pending.history.slice(-10) : [];
  return tx.trip.update({ where: { id: trip.id }, data: { sourceMetadata: {
    ...metadata,
    websiteSyncPending: {
      id: randomUUID(), trip: next, ...(created ? { created: true } : { edits }),
      archive, queuedAt: new Date().toISOString(),
      // The save delivers inline; the retry sweep waits a minute so it never races it.
      attempts: 0, nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
      ...(pending.lastError ? { lastError: pending.lastError } : {}),
      history,
    },
  } as Prisma.InputJsonValue }, include: TRIP_INCLUDE });
}

const CLAIM_MS = 45_000;

/** Takes the queued edit for this worker only; null when none is queued or another worker has it. */
async function claim(id: string): Promise<Row | null> {
  const until = new Date(Date.now() + CLAIM_MS).toISOString();
  const rows = await prisma.$queryRaw<Array<{ pending: unknown }>>`UPDATE "Trip"
    SET "sourceMetadata" = jsonb_set("sourceMetadata", '{websiteSyncPending,claimedUntil}', to_jsonb(${until}::text))
    WHERE id=${id} AND "sourceMetadata" ? 'websiteSyncPending'
      AND COALESCE(("sourceMetadata"->'websiteSyncPending'->>'claimedUntil')::timestamptz, '-infinity'::timestamptz) < now()
    RETURNING "sourceMetadata"->'websiteSyncPending' AS pending`;
  return rows[0] ? record(rows[0].pending) : null;
}

function failureOf(error: unknown) {
  if (error instanceof ChatbotSyncError) return { status: error.status, code: error.code, message: error.message.slice(0, 300) };
  const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : null;
  return { status, code: status === 424 ? "not_configured" : "error", message: error instanceof Error ? error.message.slice(0, 300) : "Unknown error" };
}

/**
 * Delivers this trip's queued website edit. Safe to call from any number of
 * workers: one claims the edit, a delivery only acknowledges the edit it sent,
 * and the chatbot's three-way merge makes a repeated delivery a no-op. A
 * failure stays queued with its error, attempt count and next retry time.
 */
export async function deliverTripSync(id: string): Promise<boolean> {
  const pending = await claim(id);
  if (!pending) {
    const trip = await prisma.trip.findUnique({ where: { id }, select: { sourceMetadata: true } });
    return typeof record(record(trip?.sourceMetadata).websiteSyncPending).id !== "string";
  }
  const at = new Date().toISOString();
  const history = Array.isArray(pending.history) ? pending.history : [];
  try {
    let report: ChatbotSyncReport = { applied: [], conflicts: [], ignored: [] };
    if (pending.archive) {
      await deleteTripFromChatbot(typeof record(pending.trip).sourceTripId === "string" ? record(pending.trip).sourceTripId as string : null);
    } else {
      const { trip, previousTrip, changedFields } = deliveryPayload(pending);
      report = await syncTripToChatbot(trip, previousTrip, changedFields);
    }
    const summary = { at, attempts: Number(pending.attempts || 0) + 1, applied: report.applied, conflicts: report.conflicts, ignored: report.ignored };
    // An older delivery must never acknowledge a newer edit's pending payload.
    const acknowledged = await prisma.$executeRaw`UPDATE "Trip"
      SET "sourceMetadata" = ("sourceMetadata" - 'websiteSyncPending' - 'canonicalExtraPatch') || jsonb_build_object('websiteSyncReport', ${JSON.stringify(summary)}::jsonb)
      WHERE id=${id} AND "sourceMetadata"->'websiteSyncPending'->>'id'=${pending.id as string}`;
    if (!acknowledged) await release(id, pending.id as string);
    return acknowledged > 0;
  } catch (error) {
    const failure = failureOf(error);
    const attempts = Number(pending.attempts || 0) + 1;
    const delay = retryDelayMinutes(attempts);
    const update = {
      attempts, lastAttemptAt: at, lastError: { ...failure, at },
      nextAttemptAt: delay === null ? null : new Date(Date.now() + delay * 60_000).toISOString(),
      ...(delay === null ? { failedAt: at } : {}),
      history: [...history, { at, ok: false, code: failure.code, status: failure.status }].slice(-20),
      claimedUntil: null,
    };
    await prisma.$executeRaw`UPDATE "Trip"
      SET "sourceMetadata" = jsonb_set("sourceMetadata", '{websiteSyncPending}', ("sourceMetadata"->'websiteSyncPending') || ${JSON.stringify(update)}::jsonb)
      WHERE id=${id} AND "sourceMetadata"->'websiteSyncPending'->>'id'=${pending.id as string}`;
    console.error("Trip sync remains queued", id, failure.code, failure.status);
    return false;
  }
}

async function release(id: string, pendingId: string) {
  await prisma.$executeRaw`UPDATE "Trip"
    SET "sourceMetadata" = jsonb_set("sourceMetadata", '{websiteSyncPending,claimedUntil}', 'null'::jsonb)
    WHERE id=${id} AND "sourceMetadata"->'websiteSyncPending'->>'id'=${pendingId}`;
}

/**
 * Retries every queued edit whose backoff has elapsed. Vercel Hobby only runs
 * crons daily, so this also runs (throttled) behind ordinary admin and site
 * traffic; see tripSyncSweep.ts.
 */
export async function retryDueTripSyncs(limit = 5): Promise<{ attempted: number; delivered: number }> {
  const due = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Trip"
    WHERE "sourceMetadata" ? 'websiteSyncPending'
      AND ("sourceMetadata"->'websiteSyncPending'->>'failedAt') IS NULL
      AND COALESCE(("sourceMetadata"->'websiteSyncPending'->>'nextAttemptAt')::timestamptz,
                   ("sourceMetadata"->'websiteSyncPending'->>'queuedAt')::timestamptz + interval '1 minute') <= now()
    ORDER BY COALESCE("sourceMetadata"->'websiteSyncPending'->>'nextAttemptAt', "sourceMetadata"->'websiteSyncPending'->>'queuedAt')
    LIMIT ${limit}`;
  let delivered = 0;
  const deadline = Date.now() + 40_000;
  for (const { id } of due) {
    if (Date.now() > deadline) break;
    if (await deliverTripSync(id)) delivered++;
  }
  return { attempted: due.length, delivered };
}
