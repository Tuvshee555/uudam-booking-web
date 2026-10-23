/**
 * The text Google and Messenger show under a trip's title.
 *
 * No imports on purpose: the tests load this file straight under Node.
 */

type DescribableTrip = {
  summary?: string | null;
  description?: string | null;
  durationDays: number;
  durationNights: number;
  price: number;
  destinations?: string[] | null;
  departures: Array<{ startDate: string | Date; status: string }>;
};

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:·–-]+$/, "")}…`;
}

function ulaanbaatarDay(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Ulaanbaatar" });
}

function money(value: number): string {
  return `${new Intl.NumberFormat("en-US").format(Math.round(value))}₮`;
}

/**
 * Most trips have no hand-written summary, and the description is often just
 * the length line ("УБ-аас 8 шөнө 9 өдөр") — or empty — so every preview said
 * almost nothing. This builds one from facts the customer is looking for: how
 * long, from what price, and when it leaves next.
 */
export function tripMetaDescription(trip: DescribableTrip, now: Date = new Date()): string {
  const summary = trip.summary?.trim();
  if (summary && summary.length >= 40) return clip(summary, 160);

  const today = ulaanbaatarDay(now);
  const nextDates = trip.departures
    .filter((departure) => departure.status === "OPEN" || departure.status === "ALMOST_FULL")
    .map((departure) => ulaanbaatarDay(departure.startDate))
    .filter((day) => day >= today)
    .sort()
    .filter((day, index, all) => all.indexOf(day) === index)
    .slice(0, 3)
    .map((day) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`);

  const facts = [
    trip.durationDays > 0 ? `${trip.durationDays} өдөр ${trip.durationNights} шөнө` : null,
    Number.isFinite(trip.price) && trip.price > 0 ? `Үнэ ${money(trip.price)}-с эхлэн` : null,
    nextDates.length ? `Ойрын гарах: ${nextDates.join(", ")}` : null,
  ].filter((part): part is string => Boolean(part));

  const route = (trip.destinations ?? []).filter(Boolean).slice(0, 5).join(" – ");
  const body = trip.description?.trim() ?? "";
  // A description that only repeats the length line adds nothing to the preview.
  const detail = body.length >= 70 ? clip(body, 90) : route;

  return clip([...facts, detail, "Хөтөлбөр, үнэ, багтсан зүйлсийг шууд харна уу."].filter(Boolean).join(" · "), 160);
}
