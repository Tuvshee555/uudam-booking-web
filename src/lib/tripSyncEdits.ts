/**
 * Which website trip fields staff changed since the chatbot last heard from
 * the website, and the value each one replaced. The chatbot's three-way merge
 * compares an edit against that value, so it has to be the value staff saw —
 * not the state before the oldest undelivered save (2026-10-16: the chatbot
 * renamed a trip "… 2", staff renamed it back, and the stale baseline made the
 * rename-back look unchanged, so it was skipped without a conflict).
 *
 * Pure: shared by the delivery queue (src/server/tripSyncQueue.ts) and tests.
 */
type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};

/** sourceMetadata keys the chatbot's bridge reads (websiteTripBridge.ts there). */
const BRIDGE_METADATA = ["price_groups", "age_rules", "hotel_profiles", "hotel_links", "canonicalExtraPatch"];
/** Fields of the chatbot's own source snapshot the bridge uses as a baseline. */
const SOURCE_FIELDS = ["id", "operator_name", "route_name", "duration_text", "adult_price", "child_price", "infant_price", "currency", "departure_dates", "has_food", "status", "notes", "hotel", "photo_urls"];
const SOURCE_EXTRA = ["website_summary", "included_items", "excluded_items", "important_notes", "departure_rule", "itinerary_days", "customer_visible", "price_groups", "age_rules", "hotel_profiles", "hotel_links",
  "aliases", "booking_terms", "discounts", "extra_fees", "room_prices", "answer_hints", "review_reasons", "needs_human_review", "transport_type", "destinations"];

/**
 * Only what the chatbot reads. A full copy carried the chatbot's own derived
 * data back to it (canonicalOffers, conflicts, the whole poster): 726 KB per
 * snapshot on the Санья trip, sent twice, so every delivery was refused as
 * too large (HTTP 413) and the 2026-10-26 edit never arrived.
 */
export function bridgeMetadata(value: unknown): Row {
  const metadata = record(value);
  const slim: Row = {};
  for (const key of BRIDGE_METADATA) if (key in metadata) slim[key] = metadata[key];
  const source = record(metadata.connectedSource);
  if (Object.keys(source).length) {
    const extra = record(source.extra);
    const subtitle = record(source.poster).subtitle;
    slim.connectedSource = {
      ...Object.fromEntries(SOURCE_FIELDS.filter((key) => key in source).map((key) => [key, source[key]])),
      extra: Object.fromEntries(SOURCE_EXTRA.filter((key) => key in extra).map((key) => [key, extra[key]])),
      ...(subtitle !== undefined ? { poster: { subtitle } } : {}),
    };
  }
  return slim;
}

/** JSON copy of a trip, as the chatbot needs it, without its own queue entry. */
export function syncSnapshot(value: unknown): Row {
  const trip = JSON.parse(JSON.stringify(value)) as Row;
  trip.sourceMetadata = bridgeMetadata(trip.sourceMetadata);
  return trip;
}

/** Bookkeeping and website-only grouping: never something staff edit for the chatbot. */
const NOT_SYNCED = new Set(["id", "createdAt", "updatedAt", "lastSyncedAt", "avgRating", "reviewCount", "salesCount", "weather", "sourceTripId", "slug", "category", "categories", "categoryId", "tags", "isFeatured", "sourceMetadata"]);
/** sourceMetadata keys the chatbot reads from a website save. */
const SYNCED_METADATA = ["price_groups", "age_rules", "hotel_profiles", "hotel_links", "canonicalExtraPatch"];

export function syncedValues(trip: Row): Map<string, unknown> {
  const values = new Map<string, unknown>();
  for (const [key, value] of Object.entries(trip)) if (!NOT_SYNCED.has(key)) values.set(key, value);
  const metadata = record(trip.sourceMetadata);
  for (const key of SYNCED_METADATA) if (key in metadata) values.set(`sourceMetadata.${key}`, metadata[key]);
  return values;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Edited fields of a queued delivery with their baselines. A queue entry from
 * before 2026-10-31 kept one whole-trip baseline; it reads back as the fields
 * that differ from it.
 */
export function pendingEdits(pending: Row): Record<string, unknown> {
  if (pending.edits && typeof pending.edits === "object") return { ...record(pending.edits) };
  const previous = record(pending.previousTrip);
  if (!Object.keys(previous).length) return {};
  const before = syncedValues(previous);
  const edits: Record<string, unknown> = {};
  for (const [field, value] of syncedValues(record(pending.trip))) {
    if (!same(before.get(field), value)) edits[field] = before.get(field) ?? null;
  }
  return edits;
}

/**
 * Folds one save into the queued edits. `previous` is the row this save
 * replaced. A field keeps its earliest baseline across undelivered saves,
 * unless the chatbot projection rewrote it in between — then what staff saw
 * (the projected value) is the baseline, and a held edit the projection
 * overwrote and this save left alone is no longer a website edit.
 */
export function foldSave(pending: Row, previous: Row, next: Row): Record<string, unknown> {
  const edits = pendingEdits(pending);
  const before = syncedValues(previous);
  const queued = Object.keys(record(pending.trip)).length ? syncedValues(record(pending.trip)) : null;
  for (const [field, value] of syncedValues(next)) {
    const old = before.get(field);
    const rewritten = queued !== null && !same(queued.get(field), old);
    if (same(old, value)) {
      if (field in edits && rewritten) delete edits[field];
      continue;
    }
    if (!(field in edits) || rewritten) edits[field] = old ?? null;
  }
  return edits;
}

/** What goes over the wire: the trip, its per-field baseline and the edited field names. */
export function deliveryPayload(pending: Row): { trip: Row; previousTrip: Row | null; changedFields?: string[] } {
  // Queue entries written before 2026-10-31 hold the full metadata.
  const trip = { ...record(pending.trip), sourceMetadata: bridgeMetadata(record(pending.trip).sourceMetadata) };
  if (pending.created === true || (!pending.edits && !pending.previousTrip)) return { trip, previousTrip: null };
  const edits = pendingEdits(pending);
  const previousMetadata: Row = { ...record(trip.sourceMetadata) };
  const previousTrip: Row = { ...trip, sourceMetadata: previousMetadata };
  for (const [field, base] of Object.entries(edits)) {
    if (field.startsWith("sourceMetadata.")) {
      const key = field.slice("sourceMetadata.".length);
      if (base === null) delete previousMetadata[key];
      else previousMetadata[key] = base;
    } else previousTrip[field] = base;
  }
  return { trip, previousTrip, changedFields: Object.keys(edits) };
}

const BACKOFF_MINUTES = [1, 2, 5, 10, 30, 60, 120, 240, 480, 720];
export const MAX_SYNC_ATTEMPTS = BACKOFF_MINUTES.length;

/** Minutes before the next automatic attempt after `attempts` failures; null stops retrying. */
export function retryDelayMinutes(attempts: number): number | null {
  return attempts >= MAX_SYNC_ATTEMPTS ? null : BACKOFF_MINUTES[Math.max(0, attempts - 1)];
}
