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
