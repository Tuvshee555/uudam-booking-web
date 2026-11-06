/**
 * What one itinerary day says about its meals.
 *
 * The chatbot sync writes only the meals that ARE included ("Өглөө", "Өдөр",
 * "Орой"); a meal the source never mentions arrives as nothing at all, exactly
 * like a meal that is not included. So a missing meal is unknown, never "not
 * included": only a label that says so itself ("Орой ороогүй", "Өдрийн хоол
 * өөрийн зардлаар") is shown as not included.
 */

export type MealKey = "breakfast" | "lunch" | "dinner";
export type MealState = "included" | "excluded";
export type MealSlot = { key: MealKey; label: string; state: MealState };

const SLOTS: Array<{ key: MealKey; label: string; match: RegExp }> = [
  { key: "breakfast", label: "Өглөө", match: /өглөө|breakfast/iu },
  { key: "lunch", label: "Өдөр", match: /(?:^|[^\p{L}])(?:өдөр|өдрийн|үдийн|lunch)/iu },
  { key: "dinner", label: "Орой", match: /орой|dinner/iu },
];

const NOT_INCLUDED = /ороогүй|орохгүй|багтаагүй|багтахгүй|хоолгүй|өөрийн|өөрөө|үгүй|not included|excluded|own expense|self[- ]?paid/iu;
/** "3 хоол", "Бүх хоол", "Full board": all three meals at once. */
const ALL_MEALS = /(?:^|[^\p{L}\p{N}])(?:3|гурван)\s*(?:удаагийн\s*|удаа\s*)?хоол|бүх\s*хоол|full\s*board|all\s*meals/iu;

/** The day's known meals, breakfast to dinner. A meal named both ways is left out as unknown. */
export function dayMealSlots(meals: readonly string[] | null | undefined): MealSlot[] {
  const states = new Map<MealKey, MealState | "conflict">();
  for (const entry of meals ?? []) {
    for (const part of String(entry).split(/[,;/]+/)) {
      const phrase = part.trim();
      if (!phrase) continue;
      const state: MealState = NOT_INCLUDED.test(phrase) ? "excluded" : "included";
      const named = SLOTS.filter((slot) => slot.match.test(phrase));
      for (const slot of named.length ? named : ALL_MEALS.test(phrase) ? SLOTS : []) {
        const previous = states.get(slot.key);
        states.set(slot.key, previous && previous !== state ? "conflict" : state);
      }
    }
  }
  return SLOTS.flatMap((slot) => {
    const state = states.get(slot.key);
    return state === "included" || state === "excluded" ? [{ key: slot.key, label: slot.label, state }] : [];
  });
}

/** One day's meal facts as the chatbot holds them: true included, false not included, null not stated. */
export type SyncedDayMeals = { breakfast: boolean | null; lunch: boolean | null; dinner: boolean | null; note: string };

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const mealFact = (value: unknown): boolean | null => (value === true ? true : value === false ? false : null);

/**
 * The chatbot sync's `sourceMetadata.itineraryMeals` entry for this day. The day's own `meals`
 * list only names included meals, so this is where "not included" and the meal note
 * ("Өдрийн хоолыг замдаа", "Оройн хоол өөрийн зардлаар") come from. By number only: a page
 * draws syncedMealsByDay, which also checks the entry still belongs to the day.
 */
export function syncedDayMeals(sourceMetadata: unknown, dayNumber: number): SyncedDayMeals | null {
  const entries = record(sourceMetadata).itineraryMeals;
  if (!Array.isArray(entries) || !(dayNumber > 0)) return null;
  const day = entries.map(record).find((entry) => Number(entry.dayNumber) === dayNumber);
  return day ? entryMeals(day) : null;
}

function entryMeals(day: Record<string, unknown>): SyncedDayMeals {
  const note = typeof day.note === "string" ? day.note.trim() : "";
  return { breakfast: mealFact(day.breakfast), lunch: mealFact(day.lunch), dinner: mealFact(day.dinner), note };
}

/** The part of a website day the synced meal facts are checked against. */
export type MealDay = {
  dayNumber: number;
  title?: string | null;
  description?: string | null;
  accommodation?: string | null;
  meals?: readonly string[] | null;
};

const fold = (value: unknown) => (typeof value === "string" ? value : "").replace(/\s+/g, " ").trim().toLocaleLowerCase();

/**
 * True while the website day is still the chatbot day the sync wrote it from. The sync
 * writes ItineraryDay.title, description and accommodation from the same days it builds
 * itineraryMeals from (an untitled day is titled "N-р өдөр"), and stores the chatbot's
 * days beside it as `sourceMetadata.itinerary_days`, which the trip page keeps. At rest
 * the three texts are equal (every live synced day, checked 2026-11-06).
 */
function stillSyncedDay(day: MealDay, source: Record<string, unknown>, dayNumber: number): boolean {
  const title = fold(source.title) || fold(`${dayNumber}-р өдөр`);
  return title === fold(day.title) && fold(source.description) === fold(day.description) && fold(source.hotel) === fold(day.accommodation);
}

/**
 * The synced meal facts for each of the website's days, in the days' order; null
 * where nothing synced still belongs to the day.
 *
 * `itineraryMeals` is keyed by day number, but a website admin save renumbers the
 * days 1..n, and the list is only rewritten by the next chatbot sync. Until then a
 * number-only lookup drew one day's "not included" and meal note on another day.
 * Deleting a day changes the count; the editor's move button (it swaps two
 * neighbours) and a delete plus a duplicate keep the count and the numbers but put
 * another day at the number. Neighbouring days often share a meal pattern, so the
 * meals alone cannot tell them apart. The rule, judged from what both sides store:
 *  - trip-wide: the list has one entry per website day, with exactly the website's
 *    day numbers. Otherwise every synced fact of the trip is ignored.
 *  - per day: the day's title, description and accommodation are those of the
 *    chatbot day of the same number in `sourceMetadata.itinerary_days`
 *    (stillSyncedDay); an entry that carries its own `title` must name the day's
 *    title too; and the meals the entry calls included are the meals the day's own
 *    list includes (the sync writes the list from those same facts). A day that
 *    fails any of these was moved or edited on the website; its facts are ignored.
 *    With no chatbot day of that number there is nothing to tell the days apart by,
 *    so the facts are ignored too.
 * Only two days with the very same title, description, accommodation and included
 * meals can still trade facts. Ignored facts fall back to the day's own meals list,
 * which never claims a ✗ it was not given.
 */
export function syncedMealsByDay(sourceMetadata: unknown, days: readonly MealDay[]): Array<SyncedDayMeals | null> {
  const none = days.map(() => null);
  const metadata = record(sourceMetadata);
  const raw = metadata.itineraryMeals;
  if (!Array.isArray(raw) || !days.length) return none;
  const entries = raw.map(record);
  const numbers = entries.map((entry) => Number(entry.dayNumber));
  if (entries.length !== days.length || new Set(numbers).size !== numbers.length || !numbers.every((value) => value > 0)) return none;
  const dayNumbers = days.map((day, index) => day.dayNumber || index + 1);
  if (!dayNumbers.every((dayNumber) => numbers.includes(dayNumber))) return none;
  const chatbotDays = Array.isArray(metadata.itinerary_days) ? metadata.itinerary_days.map(record) : [];
  return days.map((day, index) => {
    const dayNumber = dayNumbers[index];
    const entry = entries[numbers.indexOf(dayNumber)];
    const source = chatbotDays.find((chatbotDay, position) => (Number(chatbotDay.day) || position + 1) === dayNumber);
    if (!source || !stillSyncedDay(day, source, dayNumber)) return null;
    if (fold(entry.title) && fold(entry.title) !== fold(day.title)) return null;
    const synced = entryMeals(entry);
    const listed = new Set(dayMealSlots(day.meals).filter((slot) => slot.state === "included").map((slot) => slot.key));
    return SLOTS.every((slot) => (synced[slot.key] === true) === listed.has(slot.key)) ? synced : null;
  });
}

/**
 * The day's meals to draw. The day's own list wins: the website's staff may have edited it
 * after the last sync. The chatbot's "not included" only fills a meal the list does not
 * mention, and a "not stated" meal still shows nothing.
 */
export function dayMealView(meals: readonly string[] | null | undefined, synced: SyncedDayMeals | null): { slots: MealSlot[]; note: string } {
  const listed = dayMealSlots(meals);
  if (!synced) return { slots: listed, note: "" };
  const slots = SLOTS.flatMap((slot): MealSlot[] => {
    const own = listed.find((entry) => entry.key === slot.key);
    if (own) return [own];
    return synced[slot.key] === false ? [{ key: slot.key, label: slot.label, state: "excluded" }] : [];
  });
  return { slots, note: synced.note };
}
