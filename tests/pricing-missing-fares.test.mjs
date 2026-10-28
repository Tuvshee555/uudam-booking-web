import assert from "node:assert/strict";
import test from "node:test";

import { hasMissingPassengerFare, resolvePrices } from "../src/lib/pricing.ts";

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
