import assert from "node:assert/strict";
import test from "node:test";

import { addMonths, dayTitle, monthChipLabel, monthGrid, monthTitle, ulaanbaatarDay } from "../src/lib/calendar.ts";

test("today is the Ulaanbaatar date, not the server's or the visitor's", () => {
  // 31 Oct 17:30 UTC is already 1 Nov 01:30 in Ulaanbaatar.
  assert.equal(ulaanbaatarDay(Date.UTC(2026, 9, 31, 17, 30)), "2026-11-01");
  assert.equal(ulaanbaatarDay(Date.UTC(2026, 9, 31, 15, 59)), "2026-10-31");
});

test("month navigation rolls over the year in both directions", () => {
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2027-01", -1), "2026-12");
  assert.equal(addMonths("2026-11", 14), "2028-01");
});

test("the grid starts on Monday and covers leap years", () => {
  const february2028 = monthGrid("2028-02").filter(Boolean);
  assert.equal(february2028.length, 29);
  assert.equal(monthGrid("2027-02").filter(Boolean).length, 28);
  // 1 Nov 2026 is a Sunday: six blanks before it in a Monday-first week.
  const november = monthGrid("2026-11");
  assert.equal(november.findIndex(Boolean), 6);
  assert.equal(november.length % 7, 0);
  assert.equal(november[6].key, "2026-11-01");
});

test("labels read naturally in Mongolian", () => {
  assert.equal(monthTitle("2026-11"), "2026 оны 11-р сар");
  assert.equal(dayTitle("2026-11-07"), "11-р сарын 7, Бямба");
  assert.equal(monthChipLabel("2026-12", 2026), "12-р сар");
  assert.equal(monthChipLabel("2027-01", 2026), "2027 · 1-р сар");
});
