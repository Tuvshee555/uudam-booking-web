/** Clean up repeated separator punctuation for display without changing saved trip data. */
export function formatTripTitle(title: string): string {
  return title
    .replace(/\s*[-–—]{2,}\s*/g, " – ")
    .replace(/\s+[-–—]\s+/g, " – ")
    // "аялал ( Жанжиажэ – Аватар )": no space just inside brackets, so "(" never ends a line alone.
    .replace(/([([])\s+/g, "$1")
    .replace(/\s+([)\]])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Category names are stored as typed ("газар + нислэг хосолсон"); a menu or a
 * heading starts them with a capital. Display only — the record is unchanged.
 */
export function formatCategoryName(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toLocaleUpperCase("mn") + trimmed.slice(1) : trimmed;
}

/**
 * The trip's length the way the trip page, the poster and the chatbot all say
 * it: "9 өдөр 8 шөнө". Nights come from the trip itself (a 9-day trip can be
 * 7 nights), never worked out from the days; a trip with no nights stored says
 * only the days. An unknown length (0 days) is an empty string, not "0 өдөр".
 */
export function formatTripDuration(days: number | null | undefined, nights?: number | null): string {
  const dayCount = typeof days === "number" && Number.isFinite(days) ? Math.round(days) : 0;
  if (dayCount <= 0) return "";
  const nightCount = typeof nights === "number" && Number.isFinite(nights) ? Math.round(nights) : 0;
  return nightCount > 0 ? `${dayCount} өдөр ${nightCount} шөнө` : `${dayCount} өдөр`;
}

/**
 * Many titles arrive in capitals ("ХАЙНАН АРЛЫН АЯЛАЛ"). Rewriting their case
 * would misspell proper nouns, so the page sets them in a smaller, tracked
 * cut instead of letting them shout.
 */
export function isAllCapsTitle(title: string): boolean {
  const letters = title.replace(/[^\p{L}]/gu, "");
  if (letters.length < 4) return false;
  const upper = letters.replace(/[^\p{Lu}]/gu, "").length;
  return upper / letters.length > 0.8;
}
