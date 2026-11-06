import assert from "node:assert/strict";
import test from "node:test";

import { dayMealSlots } from "../src/lib/itineraryMeals.ts";

const shown = (meals) => dayMealSlots(meals).map((slot) => `${slot.label}:${slot.state}`);

test("only the meals a day lists are shown; an unmentioned meal is unknown, not 'not included'", () => {
  // What the chatbot sync sends: the included labels only.
  assert.deepEqual(shown(["Өглөө"]), ["Өглөө:included"]);
  assert.deepEqual(shown(["Өглөө", "Орой"]), ["Өглөө:included", "Орой:included"]);
  assert.deepEqual(shown([]), []);
  assert.deepEqual(shown(null), []);
});

test("a label that says a meal is not included is the only way to get a ✗", () => {
  assert.deepEqual(shown(["Өглөө", "Оройн хоол ороогүй"]), ["Өглөө:included", "Орой:excluded"]);
  assert.deepEqual(shown(["Өдрийн хоол өөрийн зардлаар"]), ["Өдөр:excluded"]);
  assert.deepEqual(shown(["Dinner not included"]), ["Орой:excluded"]);
});

test("typed meal text is read the way staff write it", () => {
  assert.deepEqual(shown(["Өглөөний цай, Өдрийн хоол"]), ["Өглөө:included", "Өдөр:included"]);
  assert.deepEqual(shown(["Breakfast; Lunch"]), ["Өглөө:included", "Өдөр:included"]);
  assert.deepEqual(shown(["3 хоол"]), ["Өглөө:included", "Өдөр:included", "Орой:included"]);
  assert.deepEqual(shown(["Бүх хоол багтаагүй"]), ["Өглөө:excluded", "Өдөр:excluded", "Орой:excluded"]);
});

test("a meal listed both ways is left out instead of guessed", () => {
  assert.deepEqual(shown(["Орой", "Орой ороогүй", "Өглөө"]), ["Өглөө:included"]);
});

test("the chatbot's per-day facts add 'not included' and the meal note; 'not stated' still shows nothing", async () => {
  const { dayMealView, syncedDayMeals } = await import("../src/lib/itineraryMeals.ts");
  const metadata = { itineraryMeals: [
    { dayNumber: 1, breakfast: true, lunch: null, dinner: false, note: "Оройн хоол өөрийн зардлаар" },
    { dayNumber: 2, breakfast: true, lunch: true, dinner: true },
  ] };
  const day1 = dayMealView(["Өглөө"], syncedDayMeals(metadata, 1));
  assert.deepEqual(day1.slots.map((slot) => `${slot.label}:${slot.state}`), ["Өглөө:included", "Орой:excluded"]);
  assert.equal(day1.note, "Оройн хоол өөрийн зардлаар");
  // Staff took lunch and dinner off on the website after the last sync: the website's list wins.
  const day2 = dayMealView(["Өглөө"], syncedDayMeals(metadata, 2));
  assert.deepEqual(day2.slots.map((slot) => `${slot.label}:${slot.state}`), ["Өглөө:included"]);
  assert.equal(syncedDayMeals(metadata, 3), null);
  assert.equal(syncedDayMeals(null, 1), null);
  assert.deepEqual(dayMealView(["Орой"], null), { slots: dayMealSlots(["Орой"]), note: "" });
});

// Invented days only. Each synced entry's included meals match the day's own list, as a fresh sync writes them.
const DAYS = [
  { dayNumber: 1, title: "Норвел хот руу", meals: ["Өдөр", "Орой"] },
  { dayNumber: 2, title: "Сарнай нуур", meals: ["Өглөө", "Орой"] },
  { dayNumber: 3, title: "Алтара хөндий", meals: ["Өглөө"] },
  { dayNumber: 4, title: "Буцах өдөр", meals: ["Өглөө", "Өдөр", "Орой"] },
];
/** The chatbot's own days the same sync stores beside itineraryMeals (sourceMetadata.itinerary_days). */
const chatbotDays = (days) => days.map((day) => ({ day: day.dayNumber, title: day.title, description: day.description ?? "", hotel: day.accommodation ?? "" }));
const SYNCED = { itinerary_days: chatbotDays(DAYS), itineraryMeals: [
  { dayNumber: 1, breakfast: false, lunch: true, dinner: true },
  { dayNumber: 2, breakfast: true, lunch: false, dinner: true, note: "Өдрийн хоолыг замдаа" },
  { dayNumber: 3, breakfast: true, lunch: null, dinner: false, note: "Оройн хоол өөрийн зардлаар" },
  { dayNumber: 4, breakfast: true, lunch: true, dinner: true },
] };

async function drawn(metadata, days) {
  const { dayMealView, syncedMealsByDay } = await import("../src/lib/itineraryMeals.ts");
  const synced = syncedMealsByDay(metadata, days);
  return days.map((day, index) => {
    const view = dayMealView(day.meals, synced[index]);
    return [day.title, view.slots.map((slot) => `${slot.label}:${slot.state}`).join(" "), view.note];
  });
}

test("synced meal facts land on their own days while the days still line up", async () => {
  assert.deepEqual(await drawn(SYNCED, DAYS), [
    ["Норвел хот руу", "Өглөө:excluded Өдөр:included Орой:included", ""],
    ["Сарнай нуур", "Өглөө:included Өдөр:excluded Орой:included", "Өдрийн хоолыг замдаа"],
    ["Алтара хөндий", "Өглөө:included Орой:excluded", "Оройн хоол өөрийн зардлаар"],
    ["Буцах өдөр", "Өглөө:included Өдөр:included Орой:included", ""],
  ]);
});

test("a website save that deletes a middle day never puts another day's ✗ or note on the renumbered days", async () => {
  // Staff deleted day 2 on the website: the save renumbers old days 3 and 4 as 2 and 3,
  // while itineraryMeals still describes the four days of the last sync.
  const renumbered = [DAYS[0], DAYS[2], DAYS[3]].map((day, index) => ({ ...day, dayNumber: index + 1 }));
  const shown = await drawn(SYNCED, renumbered);
  assert.deepEqual(shown, [
    ["Норвел хот руу", "Өдөр:included Орой:included", ""],
    ["Алтара хөндий", "Өглөө:included", ""],
    ["Буцах өдөр", "Өглөө:included Өдөр:included Орой:included", ""],
  ]);
  assert.ok(!shown.some(([, meals]) => meals.includes("excluded")), "no synced ✗ on any day");
  // A day added on the website: the counts differ, so the synced facts wait for the next sync too.
  const added = [...DAYS, { dayNumber: 5, title: "Нэмэлт өдөр", meals: [] }];
  assert.ok(!(await drawn(SYNCED, added)).some(([, meals, note]) => meals.includes("excluded") || note));
});

test("two days swapped on the website drop their synced facts; an entry's own title must match its day", async () => {
  const swapped = [DAYS[0], DAYS[2], DAYS[1], DAYS[3]].map((day, index) => ({ ...day, dayNumber: index + 1 }));
  const shown = await drawn(SYNCED, swapped);
  assert.deepEqual(shown[1], ["Алтара хөндий", "Өглөө:included", ""], "day 2's lunch ✗ and note stay off the day moved here");
  assert.deepEqual(shown[2], ["Сарнай нуур", "Өглөө:included Орой:included", ""]);
  assert.deepEqual(shown[0][1], "Өглөө:excluded Өдөр:included Орой:included", "an unmoved day keeps its facts");

  const titled = { ...SYNCED, itineraryMeals: SYNCED.itineraryMeals.map((entry, index) => ({ ...entry, title: index === 2 ? "Өөр гарчиг" : DAYS[index].title })) };
  const titledShown = await drawn(titled, DAYS);
  assert.deepEqual(titledShown[2], ["Алтара хөндий", "Өглөө:included", ""], "an entry whose own title no longer matches its day is ignored");
  assert.deepEqual(titledShown[1], (await drawn(SYNCED, DAYS))[1], "the other days keep theirs");
  const sameTitles = { ...SYNCED, itineraryMeals: SYNCED.itineraryMeals.map((entry, index) => ({ ...entry, title: ` ${DAYS[index].title.toUpperCase()} ` })) };
  assert.deepEqual(await drawn(sameTitles, DAYS), await drawn(SYNCED, DAYS));
});

// The editor's own buttons keep the count and the numbers 1..n. Invented towns; every day
// lists breakfast only, so the meals alone cannot tell the days apart.
const TOWNS = ["Норвел", "Сарнай", "Алтара", "Тэврин"].map((town, index) => ({
  dayNumber: index + 1, title: `${town} хот`, description: `${town} хотоор аялна`, accommodation: `${town} Example Inn`, meals: ["Өглөө"],
}));
const TOWN_SYNC = { itinerary_days: chatbotDays(TOWNS), itineraryMeals: TOWNS.map((day) => (
  day.dayNumber === 2
    ? { dayNumber: 2, breakfast: true, lunch: false, dinner: null, note: "Өдрийн хоол өөрийн зардлаар" }
    : { dayNumber: day.dayNumber, breakfast: true, lunch: null, dinner: null }
)) };
const renumber = (days) => days.map((day, index) => ({ ...day, dayNumber: index + 1 }));
const noSyncedFacts = (shown) => !shown.some(([, meals, note]) => meals.includes("excluded") || note);

test("days moved with the editor's move button never trade their synced ✗ or note, even with the same meals", async () => {
  assert.deepEqual((await drawn(TOWN_SYNC, TOWNS))[1], ["Сарнай хот", "Өглөө:included Өдөр:excluded", "Өдрийн хоол өөрийн зардлаар"]);
  // Staff moved day 3 above day 2: the save renumbers them, itineraryMeals still says day 2 had the ✗.
  const moved = await drawn(TOWN_SYNC, renumber([TOWNS[0], TOWNS[2], TOWNS[1], TOWNS[3]]));
  assert.deepEqual(moved, [
    ["Норвел хот", "Өглөө:included", ""],
    ["Алтара хот", "Өглөө:included", ""],
    ["Сарнай хот", "Өглөө:included", ""],
    ["Тэврин хот", "Өглөө:included", ""],
  ]);
  assert.ok(noSyncedFacts(moved));
});

test("a delete plus a duplicate keeps the count but puts no synced ✗ or note on the wrong day", async () => {
  // Day 2 deleted, the last day duplicated (the copy keeps every field): still four days numbered 1..4.
  const shown = await drawn(TOWN_SYNC, renumber([TOWNS[0], TOWNS[2], TOWNS[3], { ...TOWNS[3] }]));
  assert.ok(noSyncedFacts(shown));
  assert.deepEqual(shown.map(([title]) => title), ["Норвел хот", "Алтара хот", "Тэврин хот", "Тэврин хот"]);
});

test("a day edited on the website drops only its own synced facts; no chatbot days to compare with drops them all", async () => {
  const edited = TOWNS.map((day) => (day.dayNumber === 2 ? { ...day, description: "Шинэ тайлбар" } : day));
  assert.ok(noSyncedFacts(await drawn(TOWN_SYNC, edited)), "day 2's text changed: its ✗ and note wait for the next sync");
  const lunchOff = { ...TOWN_SYNC, itineraryMeals: TOWN_SYNC.itineraryMeals.map((entry) => ({ ...entry, lunch: false })) };
  const kept = await drawn(lunchOff, TOWNS.map((day) => (day.dayNumber === 4 ? { ...day, accommodation: "Өөр буудал" } : day)));
  assert.deepEqual(kept.map(([, meals]) => meals), ["Өглөө:included Өдөр:excluded", "Өглөө:included Өдөр:excluded", "Өглөө:included Өдөр:excluded", "Өглөө:included"]);
  assert.ok(noSyncedFacts(await drawn({ itineraryMeals: TOWN_SYNC.itineraryMeals }, TOWNS)), "without itinerary_days the days cannot be told apart");
  // Whitespace and case are not a change; a day the chatbot left untitled is the sync's "N-р өдөр".
  const spaced = TOWNS.map((day) => ({ ...day, title: ` ${day.title.toUpperCase()}  ` }));
  assert.deepEqual((await drawn(TOWN_SYNC, spaced))[1][2], "Өдрийн хоол өөрийн зардлаар");
  const untitled = { ...TOWN_SYNC, itinerary_days: TOWN_SYNC.itinerary_days.map((day) => (day.day === 2 ? { ...day, title: "" } : day)) };
  const named = TOWNS.map((day) => (day.dayNumber === 2 ? { ...day, title: "2-р өдөр" } : day));
  assert.deepEqual((await drawn(untitled, named))[1], ["2-р өдөр", "Өглөө:included Өдөр:excluded", "Өдрийн хоол өөрийн зардлаар"]);
});
