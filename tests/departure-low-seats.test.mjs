import assert from "node:assert/strict";
import test from "node:test";

import { availability } from "../src/lib/departures.ts";

const departure = (status, seatsLeft = null) => ({ id: "d", startDate: "2099-02-17T00:00:00.000Z", status, seatsLeft });

test("few seats is the date's own status: picked without any number it reads «Цөөн суудал»", () => {
  assert.equal(availability(departure("ALMOST_FULL")).label, "Цөөн суудал");
  assert.equal(availability(departure("ALMOST_FULL")).tone, "tight");
  assert.equal(availability(departure("ALMOST_FULL")).selectable, true);
});

test("every typed count is shown, and the picked «Цөөн суудал» state stands beside it (owner, 2026-11-28)", () => {
  assert.deepEqual(availability(departure("OPEN", 3)), { label: "3 суудал үлдсэн", tone: "open", selectable: true });
  assert.deepEqual(availability(departure("OPEN", 40)), { label: "40 суудал үлдсэн", tone: "open", selectable: true });
  assert.deepEqual(availability(departure("ALMOST_FULL", 19)), { label: "Цөөн суудал · 19 суудал үлдсэн", tone: "tight", selectable: true });
  assert.deepEqual(availability(departure("OPEN")), { label: "Захиалга нээлттэй", tone: "open", selectable: true }, "no count typed: no number");
  assert.equal(availability(departure("OPEN", 2)).tone, "open", "a small count never sets «Цөөн суудал» by itself");
  assert.equal(availability(departure("PAUSED", 3)).selectable, false, "a closed date never shows a count");
  assert.equal(availability(departure("SOLD_OUT", 3)).label, "Суудал дүүрсэн");
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
