import assert from "node:assert/strict";
import test from "node:test";

import { availability } from "../src/lib/departures.ts";

const departure = (status, seatsLeft = null) => ({ id: "d", startDate: "2099-02-17T00:00:00.000Z", status, seatsLeft });

test("few seats is the date's own status, never read from a typed count", () => {
  assert.equal(availability(departure("ALMOST_FULL")).label, "Цөөн суудал");
  assert.equal(availability(departure("ALMOST_FULL")).tone, "tight");
  assert.equal(availability(departure("ALMOST_FULL")).selectable, true);
  // A typed count of 3 or 5 used to call the date low; counts are never decremented.
  assert.equal(availability(departure("OPEN", 3)).tone, "open");
  assert.equal(availability(departure("OPEN", 5)).label, "Захиалга нээлттэй");
});

test("a date with no seats left is still closed", () => {
  assert.equal(availability(departure("OPEN", 0)).tone, "closed");
  assert.equal(availability(departure("SOLD_OUT")).selectable, false);
  assert.equal(availability(departure("ALMOST_FULL", 0)).tone, "closed", "a count of zero wins, as in the chatbot");
});

test("the card's starting price is the cheapest bookable upcoming date", async () => {
  const { startingPrice } = await import("../src/lib/departures.ts");
  const now = Date.parse("2026-10-16T00:00:00Z");
  const dep = (day, price, status = "OPEN") => ({ startDate: `${day}T00:00:00.000Z`, price, status, seatsLeft: null });
  const trip = { price: 2390000, departures: [
    dep("2026-10-15", 2390000), // already left
    dep("2026-10-22", 2190000, "SOLD_OUT"),
    dep("2026-11-04", 2690000), dep("2026-12-16", 3690000),
  ] };
  assert.equal(startingPrice(trip, now), 2690000);
  assert.equal(startingPrice({ price: 990000, departures: [dep("2026-11-04", null)] }, now), 990000);
});
