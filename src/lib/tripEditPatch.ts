/** A form save changes only fields the editor actually changed. */
export function changedTripFields<T extends Record<string, unknown>>(before: T, after: T): Partial<T> {
  return Object.fromEntries(Object.entries(after).filter(([key, value]) =>
    JSON.stringify(value) !== JSON.stringify(before[key]))) as Partial<T>;
}
