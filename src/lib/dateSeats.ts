/**
 * One date's seat count and its status, kept consistent while staff type (2026-11-27). The same rule runs in the
 * chatbot admin and its assistant (uudam-travel-chatbot: websiteTripSync.changeDepartureState), so a count typed in
 * any of the three leaves the date in the same state:
 *   - none left = «Дүүрсэн» (SOLD_OUT);
 *   - seats on a «Дүүрсэн» date reopen it;
 *   - «Цөөн суудал» (ALMOST_FULL) and a pause stay as staff set them: a small number never flags a date by itself.
 */

const isCount = (value: string) => value.trim() !== "" && Number.isFinite(Number(value));

/** The status a typed «Үлдсэн суудал» leaves the date in. An empty or non-numeric box changes nothing. */
export function statusAfterSeats(status: string, seatsLeft: string): string {
  if (!isCount(seatsLeft)) return status;
  if (Number(seatsLeft) <= 0) return "SOLD_OUT";
  return status === "SOLD_OUT" ? "OPEN" : status;
}

/** Picking «Нээлттэй» / «Цөөн суудал» on a date whose count is 0 clears that stale 0 (it would keep the date closed). */
export function seatsAfterStatus(status: string, seatsLeft: string): string {
  return (status === "OPEN" || status === "ALMOST_FULL") && isCount(seatsLeft) && Number(seatsLeft) <= 0 ? "" : seatsLeft;
}

/** True when the left count is above the total (both typed). */
export function seatsOverTotal(seatsTotal: string, seatsLeft: string): boolean {
  return isCount(seatsTotal) && isCount(seatsLeft) && Number(seatsLeft) > Number(seatsTotal);
}
