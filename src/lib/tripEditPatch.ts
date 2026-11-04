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

/** A value both editors changed differently: where, and what each of them typed. */
export type TripEditConflict = { path: string; mine: Json; theirs: Json };

function merge(base: Json, mine: Json, theirs: Json, path: string, conflicts: TripEditConflict[]): Json {
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
  conflicts.push({ path: path || "trip", mine, theirs });
  return mine;
}

/**
 * Three-way merge for a save that hit "edited elsewhere" (409). The usual other
 * writer is the chatbot sync, which rewrites departures and sourceMetadata on
 * every save; field-level comparison made staff re-enter every date price after
 * reopening. Departures merge per date and fare rows per date/hotel/package, so
 * only the same value changed on both sides is a conflict. `merged` keeps this
 * editor's value on a conflict; the caller decides whether that may be saved.
 */
export function mergeTripEdit<T extends Record<string, unknown>>(base: T, mine: T, theirs: T): { merged: T; conflicts: string[]; details: TripEditConflict[] } {
  const details: TripEditConflict[] = [];
  const merged = merge(base, mine, theirs, "", details) as T;
  return { merged, conflicts: details.map((conflict) => conflict.path), details };
}

const LEAF_TEXT: Record<string, string> = {
  price: "том хүний үнэ", adult_price: "том хүний үнэ", adult_price_range: "том хүний үнийн хүрээ",
  childPrice: "хүүхдийн үнэ", child_price: "хүүхдийн үнэ", child_age: "хүүхдийн нас",
  infantPrice: "нярайн үнэ", infant_price: "нярайн үнэ", infant_age: "нярайн нас",
  passenger_prices: "зорчигчдын үнэ", status: "захиалгын төлөв", seatsLeft: "үлдсэн суудал", seatsTotal: "нийт суудал",
  endDate: "буцах огноо", startDate: "гарах огноо", label: "нэр", hotel: "буудал", package_id: "аяллын төрөл", note: "тэмдэглэл",
  title: "Аяллын нэр", summary: "Товч танилцуулга", description: "Дэлгэрэнгүй тайлбар", slug: "Холбоосын хаяг",
  oldPrice: "Хямдрахаас өмнөх үнэ", discount: "Хямдрал", singleSupplement: "Ганц хүний нэмэгдэл",
  durationDays: "Хэдэн өдөр", durationNights: "Хэдэн шөнө", minTravelers: "Хүний доод тоо", maxTravelers: "Хүний дээд тоо",
  country: "Улс", city: "Хот", destinations: "Очих газрууд", meetingPoint: "Цугларах цэг", mapUrl: "Газрын зургийн холбоос",
  difficulty: "Хүндрэл", transport: "Тээвэр", languages: "Хөтчийн хэл", season: "Улирал",
  highlights: "Онцлох мөчүүд", included: "Багцад багтсан", excluded: "Багцад ороогүй", requirements: "Шаардлага",
  cancellationPolicy: "Цуцлалтын нөхцөл", importantNotes: "Чухал тэмдэглэл", image: "Үндсэн зураг", extraImages: "Нэмэлт зургууд",
  video: "Үндсэн бичлэг", videos: "Нэмэлт бичлэгүүд", hotelMedia: "Буудлын зураг, бичлэг", travelerMedia: "Аялагчдын зураг, бичлэг",
  departureRule: "Гарах өдрийн нөхцөл", extraFees: "Нэмэлт төлбөр", roomPrices: "Өрөөний үнэ", childPriceNotes: "Хүүхдийн үнийн тэмдэглэл",
  brochurePdfUrl: "PDF брошур", foodIncluded: "Хоол", isPublished: "Сайтад харагдах эсэх", isFeatured: "Онцлох",
  categoryIds: "Ангилал", categoryId: "Ангилал", tagIds: "Шошго", itinerary: "Хөтөлбөр", departures: "Огноонууд",
  age_rules: "Насны ангилал", price_groups: "Огноо тус бүрийн үнэ", hotel_profiles: "Зочид буудал", hotel_links: "Буудлын холбоос",
  health_checkup_notes: "Эрүүл мэндийн шинжилгээ", canonicalExtraPatch: "Chatbot нэмэлт мэдээлэл", sourceMetadata: "Үнэ, огнооны мэдээлэл",
};

/**
 * A conflict path as staff know the field: "2026-12-25 — том хүний үнэ"
 * rather than "sourceMetadata.price_groups[fare:2026-12-25|||].adult_price".
 * The same date fare appears under both the departure row and its fare group;
 * both read the same, so callers can collapse them.
 */
export function describeConflictPath(path: string): string {
  const parts: string[] = [];
  const pattern = /([^.[\]]+)|\[([^\]]*)\]/g;
  for (let match = pattern.exec(path); match; match = pattern.exec(path)) parts.push(match[1] ?? `[${match[2]}]`);
  let where = "";
  const leaves: string[] = [];
  for (const part of parts) {
    const key = part.startsWith("[") ? part.slice(1, -1) : part;
    if (key.startsWith("departure:")) { where = key.slice("departure:".length); continue; }
    if (key.startsWith("fare:")) {
      const [dates, hotel, packageId, label] = key.slice("fare:".length).split("|");
      const option = [hotel, packageId].filter(Boolean).join(" · ");
      where = [dates.split(",").filter(Boolean).join(", ") || "Үндсэн үнэ", option || (label && !/^\d{4}-\d{2}-\d{2}$/.test(label) ? label : "")].filter(Boolean).join(" · ");
      continue;
    }
    if (key.startsWith("id:")) continue;
    if (["sourceMetadata", "price_groups", "departures", "trip"].includes(key) && parts.length > 1) continue;
    leaves.push(LEAF_TEXT[key] ?? key);
  }
  const leaf = leaves[leaves.length - 1] ?? (LEAF_TEXT[path] ?? path);
  return where ? `${where} — ${leaf}` : leaf;
}

/** A conflicting value as a short line: a number with separators, a list by count, text as is. */
export function describeConflictValue(value: Json): string {
  if (value === null || value === undefined || value === "") return "хоосон";
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (typeof value === "boolean") return value ? "тийм" : "үгүй";
  if (typeof value === "string") return value.length > 80 ? `${value.slice(0, 77)}…` : value;
  if (Array.isArray(value)) return `${value.length} мөр`;
  return "өөр утга";
}
