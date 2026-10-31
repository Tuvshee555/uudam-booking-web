import { after } from "next/server";
import { retryDueTripSyncs } from "./tripSyncQueue";

const SWEEP_EVERY_MS = 2 * 60_000;
let lastSweep = 0;

/**
 * Vercel Hobby runs crons once a day, so queued website edits are also retried
 * behind ordinary admin and catalog requests: at most once every two minutes
 * per server instance, after the response is sent. In the usual case the
 * query finds nothing due and costs one small read.
 */
export function sweepTripSyncSoon() {
  if (Date.now() - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = Date.now();
  try {
    after(() => retryDueTripSyncs(3).then(() => undefined, (error) => console.error("Trip sync sweep failed", error)));
  } catch {
    // Outside a request (tests, scripts): nothing to piggyback on.
  }
}
