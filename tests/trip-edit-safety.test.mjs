import assert from "node:assert/strict";
import test from "node:test";
import { saveItinerary } from "../src/server/saveItinerary.ts";
import { changedTripFields } from "../src/lib/tripEditPatch.ts";
import { publicTrip } from "../src/lib/publicTrip.ts";

function fixture() {
  const rows = [{ id: "a", tripId: "t", dayNumber: 1, title: "First", location: "Keep location", video: "Keep video" }, { id: "b", tripId: "t", dayNumber: 2, title: "Second" }];
  const tx = { itineraryDay: {
    findMany: async () => rows,
    update: async ({ where, data }) => Object.assign(rows.find((row) => row.id === where.id), data),
    create: async ({ data }) => { const row = { id: "new", ...data }; rows.push(row); return row; },
  } };
  return { tx, rows };
}
test("itinerary reorders retain original IDs and rows", async () => {
  const { tx, rows } = fixture();
  await saveItinerary(tx, "t", [{ id: "b", dayNumber: 1, title: "Second" }, { id: "a", dayNumber: 2, title: "First" }]);
  assert.deepEqual(rows.map((row) => [row.id, row.dayNumber]), [["a", 2], ["b", 1]]);
  assert.equal(rows[0].video, "Keep video");
});
test("removing a day archives its existing row instead of deleting it", async () => {
  const { tx, rows } = fixture();
  const removed = await saveItinerary(tx, "t", [{ id: "a", dayNumber: 1, title: "First" }]);
  assert.equal(rows.length, 2);
  assert.ok(rows[1].dayNumber < 0);
  assert.equal(rows[1].title, "Second");
  assert.deepEqual(removed.map((day) => [day.id, day.dayNumber]), [["b", 2]]);
});
test("another trip's itinerary ID is rejected before any writes", async () => {
  const { tx, rows } = fixture();
  await assert.rejects(saveItinerary(tx, "t", [{ id: "foreign", dayNumber: 1, title: "Bad" }]));
  assert.equal(rows[0].dayNumber, 1);
});
test("a text-only form edit does not rewrite fare groups, itinerary or departures", () => {
  const before = { title: "A", sourceMetadata: { price_groups: [{ hotel: "Hotel", price: 3_000_000 }] }, departures: [{ seatsLeft: 10 }], itinerary: [{ id: "a" }], childPrice: 0 };
  assert.deepEqual(changedTripFields(before, { ...before, title: "B" }), { title: "B" });
  assert.deepEqual(changedTripFields(before, { ...before, childPrice: null }), { childPrice: null });
});
test("public trip responses hide queued edits and staff review history without changing storage", () => {
  const trip = { sourceMetadata: { price_groups: [{ adult_price: 1_000_000 }], websiteSyncPending: { previousTrip: "Private" }, connectedSource: { notes: "Private" }, shared_conflicts: ["Private"], canonicalExtraPatch: { base: "Private" } } };
  const response = publicTrip(trip);
  assert.deepEqual(response.sourceMetadata, { price_groups: [{ adult_price: 1_000_000 }] });
  assert.ok(trip.sourceMetadata.connectedSource);
});

test("a 409 rebase keeps staff's date price when the sync changed other dates and metadata", async () => {
  const { mergeTripEdit } = await import("../src/lib/tripEditPatch.ts");
  const group = (date, child) => ({ dates: [date], hotel: "Phoenix Island + Paxton", package_id: "Хөтөлбөртэй", adult_price: 2990000, child_price: child });
  const dep = (date, status) => ({ startDate: date, price: 2690000, status });
  const base = { title: "Санья", sourceMetadata: { canonicalOffers: 1, price_groups: [group("2026-11-04", 2590000), group("2026-11-11", 2590000)] },
    departures: [dep("2026-10-28", "OPEN"), dep("2026-11-04", "OPEN")] };
  // Staff raise the 11-04 child fare (GTC raised it by 200,000₮).
  const mine = structuredClone(base); mine.sourceMetadata.price_groups[0].child_price = 2790000;
  // Meanwhile the sync rewrote metadata and closed 10-28.
  const theirs = structuredClone(base); theirs.sourceMetadata.canonicalOffers = 2; theirs.departures[0].status = "SOLD_OUT";
  const { merged, conflicts } = mergeTripEdit(base, mine, theirs);
  assert.deepEqual(conflicts, []);
  assert.equal(merged.sourceMetadata.price_groups[0].child_price, 2790000);
  assert.equal(merged.sourceMetadata.price_groups[1].child_price, 2590000);
  assert.equal(merged.sourceMetadata.canonicalOffers, 2);
  assert.equal(merged.departures[0].status, "SOLD_OUT");
});

test("a 409 rebase stops when both sides changed the same fare", async () => {
  const { mergeTripEdit } = await import("../src/lib/tripEditPatch.ts");
  const base = { departures: [{ startDate: "2026-11-04", childPrice: 2390000 }] };
  const mine = { departures: [{ startDate: "2026-11-04", childPrice: 2590000 }] };
  const theirs = { departures: [{ startDate: "2026-11-04", childPrice: 2490000 }] };
  const { conflicts } = mergeTripEdit(base, mine, theirs);
  assert.deepEqual(conflicts, ["departures[departure:2026-11-04].childPrice"]);
});
