import assert from "node:assert/strict";
import test from "node:test";

import { datePriceOptions, formatPriceDelta, hasVariablePricing, priceDimensionOptions } from "../src/lib/tripPriceOptions.ts";

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
  assert.equal(datePriceOptions(trip, { startDate: "2026-09-30T16:00:00.000Z" }).length, 2);
});

test("a single ordinary price group keeps the standard booking flow", () => {
  assert.equal(hasVariablePricing({ sourceMetadata: { price_groups: [{ adult_price: 2000000 }] } }), false);
});

test("package and hotel selectors remain independent and show price deltas", () => {
  const trip = { sourceMetadata: { price_groups: [
    { hotel: "Paxton", package_id: "Хөтөлбөргүй", date_keys: ["2027-02-24"], adult_price: 2990000 },
    { hotel: "Paxton", package_id: "Хөтөлбөртэй", date_keys: ["2027-02-24"], adult_price: 3290000 },
    { hotel: "Phoenix", package_id: "Хөтөлбөргүй", date_keys: ["2027-02-24"], adult_price: 3740000 },
    { hotel: "Phoenix", package_id: "Хөтөлбөртэй", date_keys: ["2027-02-24"], adult_price: 4040000 },
  ] } };
  const options = datePriceOptions(trip, { startDate: "2027-02-24T00:00:00.000Z" });
  const selected = options[0];
  const packages = priceDimensionOptions(options, "package", selected);
  const hotels = priceDimensionOptions(options, "hotel", selected);

  assert.deepEqual(packages.map((option) => option.label), ["Хөтөлбөртэй", "Хөтөлбөргүй"]);
  assert.equal(formatPriceDelta(packages[0]), "+300,000₮");
  assert.equal(formatPriceDelta(packages[1]), "Хамгийн хямд");
  assert.deepEqual(hotels.map((option) => option.label), ["Paxton", "Phoenix"]);
  assert.equal(formatPriceDelta(hotels[1]), "+750,000₮");
  assert.equal(options.find((option) => option.key === packages[0].optionKey)?.hotel, "Paxton");
  assert.equal(options.find((option) => option.key === hotels[1].optionKey)?.packageId, "Хөтөлбөргүй");
});
