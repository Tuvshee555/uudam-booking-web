type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const amount = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

// Compare traveller-facing fares, not generated IDs or chatbot date aliases.
export function comparablePriceGroups(value: unknown) {
  return (Array.isArray(value) ? value : []).map((value) => {
    const group = object(value);
    const dates = [...new Set([group.dates, group.display_dates, group.date_keys]
      .flatMap((value) => Array.isArray(value) ? value : [])
      .map((value) => text(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "")
      .filter(Boolean))].sort();
    return {
      dates,
      label: /^\d{4}-\d{2}-\d{2}$/.test(text(group.label)) ? "" : text(group.label),
      package: text(group.package_id) || text(group.note),
      note: text(group.note),
      hotel: text(group.hotel),
      adult: amount(group.adult_price),
      child: amount(group.child_price),
      childAge: text(group.child_age),
      infant: amount(group.infant_price),
      infantAge: text(group.infant_age),
      currency: text(group.currency) || "MNT",
      passengers: (Array.isArray(group.passenger_prices) ? group.passenger_prices : []).map((value) => {
        const row = object(value);
        return { label: text(row.label), age: text(row.age_range), price: amount(row.price), currency: text(row.currency) || "MNT", note: text(row.note) };
      }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    };
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
