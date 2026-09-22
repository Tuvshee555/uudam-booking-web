/** Clean up repeated separator punctuation for display without changing saved trip data. */
export function formatTripTitle(title: string): string {
  return title
    .replace(/\s*[-–—]{2,}\s*/g, " – ")
    .replace(/\s+[-–—]\s+/g, " – ")
    .replace(/\s+/g, " ")
    .trim();
}
