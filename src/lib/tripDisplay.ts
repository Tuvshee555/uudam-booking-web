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
