import assert from "node:assert/strict";
import test from "node:test";

const { statusAfterSeats, seatsAfterStatus, seatsOverTotal } = await import("../src/lib/dateSeats.ts");

test("typing 0 seats left closes the date", () => {
  assert.equal(statusAfterSeats("OPEN", "0"), "SOLD_OUT");
  assert.equal(statusAfterSeats("ALMOST_FULL", "0"), "SOLD_OUT");
});

test("typing seats on a sold-out date reopens it", () => {
  assert.equal(statusAfterSeats("SOLD_OUT", "5"), "OPEN");
});

test("a count never flags or unflags a date by itself", () => {
  assert.equal(statusAfterSeats("OPEN", "2"), "OPEN");
  assert.equal(statusAfterSeats("ALMOST_FULL", "30"), "ALMOST_FULL");
  assert.equal(statusAfterSeats("PAUSED", "8"), "PAUSED");
});

test("an empty or unreadable box changes nothing", () => {
  assert.equal(statusAfterSeats("SOLD_OUT", ""), "SOLD_OUT");
  assert.equal(statusAfterSeats("OPEN", "  "), "OPEN");
  assert.equal(statusAfterSeats("OPEN", "abc"), "OPEN");
});

test("reopening a date clears a stale zero count, nothing else", () => {
  assert.equal(seatsAfterStatus("OPEN", "0"), "");
  assert.equal(seatsAfterStatus("ALMOST_FULL", "0"), "");
  assert.equal(seatsAfterStatus("OPEN", "7"), "7");
  assert.equal(seatsAfterStatus("SOLD_OUT", "0"), "0");
  assert.equal(seatsAfterStatus("PAUSED", "0"), "0");
  assert.equal(seatsAfterStatus("OPEN", ""), "");
});

test("seats left above the total are flagged only when both are typed", () => {
  assert.equal(seatsOverTotal("40", "41"), true);
  assert.equal(seatsOverTotal("40", "40"), false);
  assert.equal(seatsOverTotal("", "41"), false);
  assert.equal(seatsOverTotal("40", ""), false);
});
