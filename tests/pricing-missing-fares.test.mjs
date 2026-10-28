import assert from "node:assert/strict";
import test from "node:test";

import { ageBandsFor, hasMissingPassengerFare, passengerFareLabel, resolvePrices } from "../src/lib/pricing.ts";

test("adult-only booking does not require unknown minor fares", () => {
  const prices = resolvePrices({ price: 1000, childPrice: null, infantPrice: null });
  assert.equal(hasMissingPassengerFare({ children: 0, infants: 0 }, prices), false);
});

test("child or infant without a fare requires a quote", () => {
  const prices = resolvePrices({ price: 1000, childPrice: null, infantPrice: null });
  assert.equal(hasMissingPassengerFare({ children: 1, infants: 0 }, prices), true);
  assert.equal(hasMissingPassengerFare({ children: 0, infants: 1 }, prices), true);
});

test("a published zero fare is distinct from an unknown fare", () => {
  const prices = resolvePrices({ price: 1000, childPrice: 800, infantPrice: 0 });
  assert.equal(hasMissingPassengerFare({ children: 1, infants: 1 }, prices), false);
});

test("unpriced infant can display a supplied non-numeric fare label", () => {
  const metadata = { infant_fare_label: "Insurance only" };
  assert.equal(passengerFareLabel(metadata, "infant", null), "Insurance only");
  assert.notEqual(passengerFareLabel(metadata, "infant", 500), "Insurance only");
});

test("a child fare range is visible without becoming a checkout price", () => {
  const metadata = { child_fare_label: "500–3,000" };
  const prices = resolvePrices({ price: 4000, childPrice: null, infantPrice: null });
  assert.equal(passengerFareLabel(metadata, "child", prices.child), "500–3,000");
  assert.equal(hasMissingPassengerFare({ children: 1, infants: 0 }, prices), true);
});

test("trip-specific age bands do not invent unspecified ranges", () => {
  const bands = ageBandsFor({ omit_unspecified_age_bands: true, age_rules: { infant: "0–2" } });
  assert.deepEqual(bands, { adult: "", child: "", infant: "0–2" });
});
