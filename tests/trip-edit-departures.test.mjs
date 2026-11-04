import assert from "node:assert/strict";
import test from "node:test";

import { editableDepartures } from "../src/lib/tripEditDepartures.ts";

const dep = (startDate, status) => ({ id: startDate, startDate: `${startDate}T00:00:00.000Z`, status });

test("a date removed in the editor (cancelled, no fare entry) is not listed again after a refresh", () => {
  const trip = {
    sourceMetadata: { price_groups: [{ dates: ["2026-12-01"], adult_price: 1 }, { date_keys: ["2026-12-08", "12 сарын 8"], adult_price: 1 }] },
    departures: [dep("2026-12-01", "OPEN"), dep("2026-12-08", "CANCELLED"), dep("2027-03-16", "CANCELLED"), dep("2027-04-16", "OPEN")],
  };
  assert.deepEqual(editableDepartures(trip).map((d) => d.id), ["2026-12-01", "2026-12-08", "2027-04-16"]);
});

test("a trip without fare groups lists every date except cancelled ones", () => {
  const trip = { sourceMetadata: null, departures: [dep("2026-12-01", "OPEN"), dep("2026-12-08", "SOLD_OUT"), dep("2026-12-15", "CANCELLED")] };
  assert.deepEqual(editableDepartures(trip).map((d) => d.id), ["2026-12-01", "2026-12-08"]);
});

test("dates stored at Ulaanbaatar midnight still match their fare entry", () => {
  const trip = { sourceMetadata: { price_groups: [{ dates: ["2026-12-01"] }] }, departures: [{ id: "x", startDate: "2026-11-30T16:00:00.000Z", status: "CANCELLED" }] };
  assert.equal(editableDepartures(trip).length, 1);
});
