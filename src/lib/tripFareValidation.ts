/**
 * Fares a trip save may carry. A negative amount is always a typing slip (a
 * stray "-" in front of 2,890,000), and once stored it reads as "Үнэ лавлах"
 * on the site while the editor shows a nonsense number. Refused before any
 * write, naming the field so staff can find it.
 *
 * Pure: shared by the API routes and the tests.
 */
type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};

const TRIP_FARES: Record<string, string> = {
  price: "Том хүний үндсэн үнэ",
  oldPrice: "Хямдрахаас өмнөх үнэ",
  childPrice: "Хүүхдийн үнэ",
  infantPrice: "Нярайн үнэ",
  singleSupplement: "Ганц хүний нэмэгдэл",
};
const DEPARTURE_FARES: Record<string, string> = { price: "том хүний үнэ", childPrice: "хүүхдийн үнэ", infantPrice: "нярайн үнэ" };
const GROUP_FARES: Record<string, string> = { adult_price: "том хүний үнэ", child_price: "хүүхдийн үнэ", infant_price: "нярайн үнэ" };

function negative(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount < 0;
}

/** The first negative fare in a trip payload, described for staff; null when every fare is sound. */
export function findNegativeFare(body: Row): string | null {
  for (const [key, label] of Object.entries(TRIP_FARES)) if (negative(body[key])) return label;
  for (const raw of Array.isArray(body.departures) ? body.departures : []) {
    const departure = record(raw);
    const date = typeof departure.startDate === "string" ? departure.startDate.slice(0, 10) : "";
    for (const [key, label] of Object.entries(DEPARTURE_FARES)) if (negative(departure[key])) return `${date} — ${label}`;
  }
  const groups = record(body.sourceMetadata).price_groups;
  for (const raw of Array.isArray(groups) ? groups : []) {
    const group = record(raw);
    const date = (Array.isArray(group.dates) ? group.dates : []).map(String).find((entry) => /^\d{4}-\d{2}-\d{2}/.test(entry))?.slice(0, 10) ?? "Үндсэн үнэ";
    for (const [key, label] of Object.entries(GROUP_FARES)) if (negative(group[key])) return `${date} — ${label}`;
    for (const rawRow of Array.isArray(group.passenger_prices) ? group.passenger_prices : []) {
      const row = record(rawRow);
      if (negative(row.price)) return `${date} — ${typeof row.label === "string" && row.label.trim() ? row.label.trim() : "зорчигчийн"} үнэ`;
    }
  }
  return null;
}
