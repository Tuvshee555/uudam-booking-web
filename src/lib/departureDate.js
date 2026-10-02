/**
 * Calendar day in Ulaanbaatar, including imports stored at local midnight.
 * @param {string | Date} value
 */
export function departureDateKey(value) {
  return new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
