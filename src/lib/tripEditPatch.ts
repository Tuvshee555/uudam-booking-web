/** A form save changes only fields the editor actually changed. */
export function changedTripFields<T extends Record<string, unknown>>(before: T, after: T): Partial<T> {
  return Object.fromEntries(Object.entries(after).filter(([key, value]) =>
    JSON.stringify(value) !== JSON.stringify(before[key]))) as Partial<T>;
}

type Json = unknown;
const same = (a: Json, b: Json) => JSON.stringify(a) === JSON.stringify(b);
const isObject = (value: Json): value is Record<string, Json> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** One stable key per departure (its date) or fare row (date, hotel, package). */
function rowKey(value: Json): string | null {
  if (!isObject(value)) return null;
  if (typeof value.startDate === "string") return `departure:${value.startDate}`;
  const dates = Array.isArray(value.dates) ? value.dates : Array.isArray(value.date_keys) ? value.date_keys : null;
  if (dates) return `fare:${dates.join(",")}|${String(value.hotel ?? "")}|${String(value.package_id ?? "")}|${String(value.label ?? "")}`;
  if (typeof value.id === "string") return `id:${value.id}`;
  return null;
}

function keyed(rows: Json[]): Map<string, Json> | null {
  const map = new Map<string, Json>();
  for (const row of rows) {
    const key = rowKey(row);
    if (!key || map.has(key)) return null;
    map.set(key, row);
  }
  return map;
}

function merge(base: Json, mine: Json, theirs: Json, path: string, conflicts: string[]): Json {
  if (same(mine, base)) return theirs;
  if (same(theirs, base) || same(mine, theirs)) return mine;
  if (isObject(base) && isObject(mine) && isObject(theirs)) {
    const out: Record<string, Json> = {};
    for (const key of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      const value = merge(base[key], mine[key], theirs[key], path ? `${path}.${key}` : key, conflicts);
      if (value !== undefined) out[key] = value;
    }
    return out;
  }
  if (Array.isArray(base) && Array.isArray(mine) && Array.isArray(theirs)) {
    const [b, m, t] = [keyed(base), keyed(mine), keyed(theirs)];
    if (b && m && t) {
      const out: Json[] = [];
      for (const key of new Set([...t.keys(), ...m.keys()])) {
        const value = merge(b.get(key), m.get(key), t.get(key), `${path}[${key}]`, conflicts);
        if (value !== undefined) out.push(value);
      }
      return out;
    }
  }
  conflicts.push(path || "trip");
  return mine;
}

/**
 * Three-way merge for a save that hit "edited elsewhere" (409). The usual other
 * writer is the chatbot sync, which rewrites departures and sourceMetadata on
 * every save; field-level comparison made staff re-enter every date price after
 * reopening. Departures merge per date and fare rows per date/hotel/package, so
 * only the same value changed on both sides is a conflict.
 */
export function mergeTripEdit<T extends Record<string, unknown>>(base: T, mine: T, theirs: T): { merged: T; conflicts: string[] } {
  const conflicts: string[] = [];
  const merged = merge(base, mine, theirs, "", conflicts) as T;
  return { merged, conflicts };
}
