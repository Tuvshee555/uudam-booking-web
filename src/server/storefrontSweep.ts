import { after } from "next/server";

import { expireStaleHolds } from "./booking";
import { revalidateSeatChanges, revalidateStorefront } from "./revalidate";
import { menuChangedSinceRender } from "./siteNavCache";

const SWEEP_EVERY_MS = 5 * 60_000;
let lastSweep = 0;

/**
 * Two changes nobody announces, caught behind ordinary page views because
 * Hobby crons run once a day:
 *
 * - a 60-minute hold that ran out: its seats go back on sale, and a date it
 *   had filled shows as bookable again;
 * - the menu moving under the cached pages: the chatbot publishing or
 *   withdrawing a trip straight in this database, or a script.
 *
 * At most once every five minutes per server instance, after the response.
 * Usually one small query for holds and three for the menu, finding nothing.
 */
export function sweepStorefrontSoon() {
  if (Date.now() - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = Date.now();
  try {
    after(async () => {
      try {
        const { seatChanges } = await expireStaleHolds();
        revalidateSeatChanges(seatChanges);
        if (await menuChangedSinceRender()) revalidateStorefront();
      } catch (error) {
        console.error("Storefront sweep failed", error);
      }
    });
  } catch {
    // Outside a request (tests, scripts): nothing to piggyback on.
  }
}
