import assert from "node:assert/strict";
import test from "node:test";

import { describeConflictPath, describeConflictValue, mergeTripEdit } from "../src/lib/tripEditPatch.ts";

test("conflict paths read as the fields staff know", () => {
  assert.equal(describeConflictPath("departures[departure:2026-12-25].price"), "2026-12-25 — том хүний үнэ");
  assert.equal(describeConflictPath("sourceMetadata.price_groups[fare:2026-12-25|||2026-12-25].adult_price"), "2026-12-25 — том хүний үнэ");
  assert.equal(describeConflictPath("sourceMetadata.price_groups[fare:2026-11-04|Sarnai Island + Altara|Хөтөлбөртэй|].child_price"), "2026-11-04 · Sarnai Island + Altara · Хөтөлбөртэй — хүүхдийн үнэ");
  assert.equal(describeConflictPath("departures[departure:2026-12-25].status"), "2026-12-25 — захиалгын төлөв");
  assert.equal(describeConflictPath("title"), "Аяллын нэр");
  assert.equal(describeConflictPath("sourceMetadata.age_rules.child"), "child");
  assert.equal(describeConflictPath("itinerary[id:abc].title"), "Аяллын нэр");
});

test("a same-field conflict reports both values", () => {
  const base = { departures: [{ startDate: "2026-12-25", price: 3190000 }], title: "A" };
  const mine = { departures: [{ startDate: "2026-12-25", price: 3320000 }], title: "A" };
  const theirs = { departures: [{ startDate: "2026-12-25", price: 3310000 }], title: "B" };
  const { merged, conflicts, details } = mergeTripEdit(base, mine, theirs);
  assert.deepEqual(conflicts, ["departures[departure:2026-12-25].price"]);
  assert.deepEqual(details, [{ path: "departures[departure:2026-12-25].price", mine: 3320000, theirs: 3310000 }]);
  assert.equal(merged.title, "B", "their rename is kept");
  assert.equal(merged.departures[0].price, 3320000, "my value is kept for the caller to decide");
});

test("values read as short lines", () => {
  assert.equal(describeConflictValue(3310000), "3,310,000");
  assert.equal(describeConflictValue(null), "хоосон");
  assert.equal(describeConflictValue(["a", "b"]), "2 мөр");
  assert.equal(describeConflictValue("Нэр"), "Нэр");
});
