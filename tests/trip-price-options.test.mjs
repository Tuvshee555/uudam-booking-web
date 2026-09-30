import assert from "node:assert/strict";
import test from "node:test";

import { datePriceOptions, hasVariablePricing } from "../src/lib/tripPriceOptions.ts";

test("hotel fares match only their departure and preserve age tiers", () => {
  const trip = { sourceMetadata: { price_groups: [
    { hotel: "Phoenix", date_keys: ["2026-10-01"], adult_price: 3290000,
      passenger_prices: [{ label: "Хүүхэд 6-11 нас", age_range: "6-11 нас", price: 3090000 }] },
    { hotel: "Paxton", date_keys: ["2026-10-01"], adult_price: 2790000,
      passenger_prices: [{ label: "Хүүхэд 2-5 нас", age_range: "2-5 нас", price: 2390000 }] },
  ] } };
  const options = datePriceOptions(trip, { startDate: "2026-10-01T00:00:00.000Z" });
  assert.equal(options.length, 2);
  assert.equal(options[0].hotel, "Phoenix");
  assert.equal(options[1].passengers[0].price, 2390000);
  assert.deepEqual(datePriceOptions(trip, { startDate: "2026-10-08T00:00:00.000Z" }), []);
  assert.equal(hasVariablePricing(trip), true);
});

test("a single ordinary price group keeps the standard booking flow", () => {
  assert.equal(hasVariablePricing({ sourceMetadata: { price_groups: [{ adult_price: 2000000 }] } }), false);
});
