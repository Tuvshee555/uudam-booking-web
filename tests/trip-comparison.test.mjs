import assert from "node:assert/strict";
import test from "node:test";
import { comparablePriceGroups } from "../src/lib/tripComparison.ts";

const fare = { dates: ["2026-12-06"], adult_price: 5890000, child_price: 4690000, note: "Guided", passenger_prices: [{ label: "Child", age_range: "2-12", price: 4690000 }] };

test("comparison ignores generated IDs, duplicate dates and natural-language aliases", () => {
  const website = { ...fare, id: "generated", currency: "MNT", date_keys: ["2026-12-06"], availability: { status: "open" } };
  const chatbot = { ...fare, date_keys: ["2026-12-06", "12/06", "12 сарын 6"] };
  assert.deepEqual(comparablePriceGroups([website]), comparablePriceGroups([chatbot]));
});

test("comparison preserves actual price, date, hotel, package and age differences", () => {
  for (const patch of [{ adult_price: 6000000 }, { child_price: 4700000 }, { child_age: "3-12" }, { infant_price: 0 }, { infant_age: "0-23 months" }, { dates: ["2026-12-13"] }, { hotel: "Other" }, { package_id: "Free" }, { label: "Premium" }, { note: "Extra meals" }, { passenger_prices: [{ label: "Child", age_range: "3-12", price: 4690000 }] }]) {
    assert.notDeepEqual(comparablePriceGroups([fare]), comparablePriceGroups([{ ...fare, ...patch }]));
  }
});

test("group order does not affect fare comparison", () => {
  const second = { ...fare, dates: ["2026-12-13"], adult_price: 6000000 };
  assert.deepEqual(comparablePriceGroups([fare, second]), comparablePriceGroups([second, fare]));
});
