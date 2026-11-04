import assert from "node:assert/strict";
import test from "node:test";

import { findNegativeFare } from "../src/lib/tripFareValidation.ts";

test("a sound payload passes", () => {
  assert.equal(findNegativeFare({ price: 2_890_000, childPrice: null, departures: [{ startDate: "2026-12-01", price: 2_890_000, childPrice: "" }], sourceMetadata: { price_groups: [{ dates: ["2026-12-01"], adult_price: 2_890_000, passenger_prices: [{ label: "Хүүхэд", price: 0 }] }] } }), null);
});

test("a negative date fare is named by its date", () => {
  assert.equal(findNegativeFare({ departures: [{ startDate: "2026-12-01", price: -5 }] }), "2026-12-01 — том хүний үнэ");
  assert.equal(findNegativeFare({ sourceMetadata: { price_groups: [{ dates: ["2026-12-08"], child_price: -1 }] } }), "2026-12-08 — хүүхдийн үнэ");
  assert.equal(findNegativeFare({ sourceMetadata: { price_groups: [{ dates: ["2026-12-08"], passenger_prices: [{ label: "Ахмад", price: -2 }] }] } }), "2026-12-08 — Ахмад үнэ");
});

test("a negative base fare is named", () => {
  assert.equal(findNegativeFare({ price: -2_890_000 }), "Том хүний үндсэн үнэ");
  assert.equal(findNegativeFare({ singleSupplement: "-100" }), "Ганц хүний нэмэгдэл");
});
