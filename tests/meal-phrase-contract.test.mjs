import assert from "node:assert/strict";
import test from "node:test";

import { dayMealSlots } from "../src/lib/itineraryMeals.ts";

// The meal-phrase contract. The SAME table lives in uudam-travel-chatbot/tests/meal-phrase-contract.test.ts:
// the website draws these phrases and the chatbot's bridge (websiteTripBridge.ts) turns them into its
// facts with a copy of these rules. Change a row here only together with the chatbot's table.
// "in" = included, "out" = not included, null = not stated.
const MEAL_PHRASE_CONTRACT = [
  { meals: ["Өглөө"], breakfast: "in", lunch: null, dinner: null },
  { meals: ["Өглөө", "Өдөр", "Орой"], breakfast: "in", lunch: "in", dinner: "in" },
  { meals: ["Өглөө, Өдрийн хоол, Орой үгүй"], breakfast: "in", lunch: "in", dinner: "out" },
  { meals: ["Оройн хоол өөрийн зардлаар"], breakfast: null, lunch: null, dinner: "out" },
  { meals: ["Үдийн хоол"], breakfast: null, lunch: "in", dinner: null },
  { meals: ["Өдрийн хоол өөрөө"], breakfast: null, lunch: "out", dinner: null },
  { meals: ["3 хоол"], breakfast: "in", lunch: "in", dinner: "in" },
  { meals: ["Бүх хоол"], breakfast: "in", lunch: "in", dinner: "in" },
  { meals: ["Full board"], breakfast: "in", lunch: "in", dinner: "in" },
  { meals: ["Breakfast; Lunch"], breakfast: "in", lunch: "in", dinner: null },
  { meals: ["Dinner not included"], breakfast: null, lunch: null, dinner: "out" },
  { meals: ["Орой", "Орой ороогүй", "Өглөө"], breakfast: "in", lunch: null, dinner: null },
  { meals: [], breakfast: null, lunch: null, dinner: null },
];

test("the website draws every contract phrase exactly as the chatbot's bridge reads it", () => {
  for (const row of MEAL_PHRASE_CONTRACT) {
    const slots = dayMealSlots(row.meals);
    const state = (key) => {
      const slot = slots.find((entry) => entry.key === key);
      return slot ? (slot.state === "included" ? "in" : "out") : null;
    };
    assert.deepEqual(
      { breakfast: state("breakfast"), lunch: state("lunch"), dinner: state("dinner") },
      { breakfast: row.breakfast, lunch: row.lunch, dinner: row.dinner },
      JSON.stringify(row.meals),
    );
  }
});
