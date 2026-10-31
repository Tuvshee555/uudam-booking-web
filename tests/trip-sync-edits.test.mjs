import assert from "node:assert/strict";
import test from "node:test";

import { deliveryPayload, foldSave, pendingEdits, retryDelayMinutes, syncSnapshot } from "../src/lib/tripSyncEdits.ts";

const trip = (fields) => ({ id: "t1", sourceTripId: "src-1", updatedAt: "2026-10-16T06:40:00.000Z", sourceMetadata: {}, ...fields });

test("B2: a field the chatbot rewrote and staff changed back keeps the value staff saw as its baseline", () => {
  // 1. An undelivered website save changed the description.
  const pending = { trip: trip({ title: "Чунчин аялал", description: "Шинэ" }), edits: foldSave({}, trip({ title: "Чунчин аялал", description: "Хуучин" }), trip({ title: "Чунчин аялал", description: "Шинэ" })) };
  assert.deepEqual(pending.edits, { description: "Хуучин" });
  // 2. The chatbot renamed the trip "… 2"; its projection showed that name here.
  const projected = trip({ title: "Чунчин аялал 2", description: "Шинэ" });
  // 3. Staff removed the "2" again.
  const edits = foldSave(pending, projected, trip({ title: "Чунчин аялал", description: "Шинэ" }));
  assert.deepEqual(edits, { description: "Хуучин", title: "Чунчин аялал 2" });
  const payload = deliveryPayload({ trip: trip({ title: "Чунчин аялал", description: "Шинэ" }), edits });
  assert.equal(payload.previousTrip.title, "Чунчин аялал 2", "the chatbot compares against the name staff replaced");
  assert.deepEqual(payload.changedFields, ["description", "title"]);
});

test("a held edit the chatbot projection overwrote, and staff left alone, is no longer sent", () => {
  const pending = { trip: trip({ hotel: "Website hotel" }), edits: { hotel: "Old hotel" } };
  const projected = trip({ hotel: "Chatbot hotel" });
  assert.deepEqual(foldSave(pending, projected, trip({ hotel: "Chatbot hotel", summary: "Шинэ товч" })), { summary: null });
});

test("bookkeeping never counts as an edit; sourceMetadata keys the chatbot reads do", () => {
  const before = trip({ price: 1_000_000, sourceMetadata: { connectedSource: { id: "src-1" } } });
  const after = trip({ price: 1_000_000, updatedAt: "2026-10-31T00:00:00.000Z", avgRating: 5, sourceMetadata: { connectedSource: { id: "src-1", x: 1 }, price_groups: [{ adult_price: 1 }] } });
  assert.deepEqual(foldSave({}, before, after), { "sourceMetadata.price_groups": null });
  const payload = deliveryPayload({ trip: after, edits: { "sourceMetadata.price_groups": null } });
  assert.equal("price_groups" in payload.previousTrip.sourceMetadata, false, "an absent baseline stays absent, not null");
});

test("a queue entry from before per-field baselines is read as the fields that differ", () => {
  const legacy = { trip: trip({ departures: [{ startDate: "2026-11-04", status: "SOLD_OUT" }], updatedAt: "2026-10-26T07:27:23.132Z" }),
    previousTrip: trip({ departures: [{ startDate: "2026-11-04", status: "OPEN" }], updatedAt: "2026-10-18T09:54:03.911Z" }) };
  assert.deepEqual(pendingEdits(legacy), { departures: [{ startDate: "2026-11-04", status: "OPEN" }] });
  assert.deepEqual(deliveryPayload(legacy).changedFields, ["departures"]);
});

test("a new trip is delivered whole, without a baseline", () => {
  const payload = deliveryPayload({ created: true, trip: trip({ title: "Шинэ" }) });
  assert.equal(payload.previousTrip, null);
  assert.equal(payload.changedFields, undefined);
});

test("retries back off and stop after ten failures", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(retryDelayMinutes), [1, 2, 5, 10, 30, 60, 120, 240, 480, null]);
});

test("the snapshot drops the trip's own queue entry", () => {
  const snapshot = syncSnapshot(trip({ sourceMetadata: { websiteSyncPending: { id: "x" }, price_groups: [] } }));
  assert.deepEqual(snapshot.sourceMetadata, { price_groups: [] });
});
