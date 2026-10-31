/**
 * Plain-language state of one trip's website → chatbot sync, read from what
 * the delivery queue (src/server/tripSyncQueue.ts) leaves in sourceMetadata.
 * Shared by the trip editor, the conflict panel and the daily health check.
 */
type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};

export const SYNC_ERROR_TEXT: Record<string, string> = {
  timeout: "Chatbot 20 секундэд хариу өгсөнгүй",
  network: "Chatbot-той холбогдож чадсангүй",
  not_configured: "Сайт дээр chatbot синк тохируулаагүй байна",
  unauthorized: "Синкийн нууц түлхүүр таарахгүй байна",
  trip_edit_conflict: "Chatbot дээр яг тэр үед өөр засвар хадгалагдсан",
  invalid_trip_sync_payload: "Chatbot энэ мэдээллийг хүлээж авсангүй",
  trip_sync_failed: "Chatbot талд алдаа гарсан",
  http_error: "Chatbot алдаа буцаасан",
};

export const IGNORED_REASON_TEXT: Record<string, string> = {
  fare_below_1000: "1,000₮-өөс бага үнэ — буруу бичсэн байж магадгүй",
  open_conflict: "өмнөх шийдээгүй зөрүүтэй",
  status_owned_by_chatbot: "төлвийг chatbot удирддаг",
  not_applied: "chatbot хүлээж аваагүй",
};

/** Names of website fields and chatbot conflict paths, as staff know them. */
export const SYNC_FIELD_TEXT: Record<string, string> = {
  title: "Аяллын нэр", route_name: "Аяллын нэр", description: "Тайлбар", notes: "Тайлбар", summary: "Товч тайлбар",
  "extra.website_summary": "Товч тайлбар", hotel: "Буудал", currency: "Валют",
  price: "Том хүний үнэ", adult_price: "Том хүний үнэ", childPrice: "Хүүхдийн үнэ", child_price: "Хүүхдийн үнэ",
  infantPrice: "Нярайн үнэ", infant_price: "Нярайн үнэ", durationDays: "Хоног", durationNights: "Шөнө", duration_text: "Үргэлжлэх хугацаа",
  foodIncluded: "Хоол", has_food: "Хоол", isPublished: "Нийтлэх эсэх", status: "Төлөв", "extra.customer_visible": "Нийтэд харагдах",
  image: "Нүүр зураг", extraImages: "Зургийн цомог", photo_urls: "Зургууд", departures: "Огноо, суудал", departure_dates: "Огнооны жагсаалт",
  "extra.website_departure_availability": "Суудал, захиалгын төлөв", "extra.price_groups": "Огноо тус бүрийн үнэ",
  "sourceMetadata.price_groups": "Огноо тус бүрийн үнэ", included: "Багтсан зүйлс", "extra.included_items": "Багтсан зүйлс",
  excluded: "Багтаагүй зүйлс", "extra.excluded_items": "Багтаагүй зүйлс", importantNotes: "Чухал тэмдэглэл", "extra.important_notes": "Чухал тэмдэглэл",
  departureRule: "Хөдлөх нөхцөл", "extra.departure_rule": "Хөдлөх нөхцөл", itinerary: "Хөтөлбөр", "extra.itinerary_days": "Хөтөлбөр",
  "sourceMetadata.age_rules": "Насны ангилал", "extra.age_rules": "Насны ангилал", "extra.child_rules": "Хүүхэд, нярайн үнийн дүрэм",
};

const FARE_TEXT: Record<string, string> = { price: "том хүний үнэ", childPrice: "хүүхдийн үнэ", infantPrice: "нярайн үнэ" };

export function syncFieldText(field: string): string {
  if (SYNC_FIELD_TEXT[field]) return SYNC_FIELD_TEXT[field];
  const departure = field.match(/^departure\.(\d{4}-\d{2}-\d{2})\.(price|childPrice|infantPrice)$/);
  if (departure) return `${departure[1]} — ${FARE_TEXT[departure[2]]}`;
  const photo = field.match(/^extra\.itinerary_days\.(\d+)\.photo$/);
  if (photo) return `Хөтөлбөрийн ${photo[1]}-р өдрийн зураг`;
  return field;
}

export type SyncState = "synced" | "sending" | "retrying" | "failed";

export type TripSyncStatus = {
  state: SyncState;
  attempts: number;
  queuedAt: string | null;
  nextAttemptAt: string | null;
  error: string | null;
  /** Website fields the last delivery could not apply. */
  ignored: Array<{ field: string; reason: string }>;
  /** Unresolved website ↔ chatbot disagreements. */
  conflicts: number;
};

export function tripSyncStatus(sourceMetadata: unknown): TripSyncStatus {
  const metadata = record(sourceMetadata);
  const pending = record(metadata.websiteSyncPending);
  const report = record(metadata.websiteSyncReport);
  const conflicts = Array.isArray(metadata.shared_conflicts) ? metadata.shared_conflicts.length : 0;
  const ignored = (Array.isArray(report.ignored) ? report.ignored : [])
    .map(record)
    .filter((entry) => typeof entry.field === "string")
    .map((entry) => ({ field: entry.field as string, reason: typeof entry.reason === "string" ? entry.reason : "not_applied" }));
  if (typeof pending.id !== "string") return { state: "synced", attempts: 0, queuedAt: null, nextAttemptAt: null, error: null, ignored, conflicts };
  const lastError = record(pending.lastError);
  const code = typeof lastError.code === "string" ? lastError.code : null;
  const attempts = typeof pending.attempts === "number" ? pending.attempts : 0;
  const error = code ? SYNC_ERROR_TEXT[code] ?? (typeof lastError.message === "string" ? lastError.message : code) : null;
  return {
    state: pending.failedAt ? "failed" : attempts > 0 ? "retrying" : "sending",
    attempts,
    queuedAt: typeof pending.queuedAt === "string" ? pending.queuedAt : null,
    nextAttemptAt: typeof pending.nextAttemptAt === "string" ? pending.nextAttemptAt : null,
    error,
    ignored,
    conflicts,
  };
}
