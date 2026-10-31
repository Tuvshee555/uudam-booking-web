import assert from "node:assert/strict";
import test from "node:test";

import { checkCatalog, checkTrip, comparePartnerFares } from "../src/lib/tripHealth.ts";

const TODAY = "2026-10-20";
const NOW = Date.parse("2026-10-20T04:00:00Z");
const dep = (day, extra = {}) => ({ startDate: `${day}T00:00:00.000Z`, status: "OPEN", price: 2690000, childPrice: 2390000, seatsLeft: null, ...extra });
const trip = (extra = {}) => ({ id: "t1", slug: "sanya", title: "ХАЙНАН – САНЬЯА АЯЛАЛ", isPublished: true, price: 2690000, image: "x.jpg", sourceMetadata: {}, departures: [dep("2026-11-04")], ...extra });
const codes = (issues) => issues.map((issue) => issue.code).sort();

test("a clean published trip has no issues; a draft is never checked", () => {
  assert.deepEqual(checkTrip(trip(), TODAY, NOW), []);
  assert.deepEqual(checkTrip(trip({ isPublished: false, image: "", departures: [] }), TODAY, NOW), []);
});

test("Хайкоу: a 2027 copy of a 2026 departure is flagged, the real date is not", () => {
  const issues = checkTrip(trip({ departures: [dep("2026-09-15", { status: "DEPARTED" }), dep("2026-11-24"), dep("2027-09-15")] }), TODAY, NOW);
  assert.deepEqual(codes(issues), ["year_copy_date"]);
  assert.match(issues[0].message, /2027-09-15/);
  assert.doesNotMatch(issues[0].message, /2026-11-24/);
});

test("child fares above adult fares and bookable dates without a price are errors", () => {
  const issues = checkTrip(trip({ price: 0, departures: [dep("2026-11-04", { childPrice: 2790000 }), dep("2026-11-11", { price: null, childPrice: null })] }), TODAY, NOW);
  assert.deepEqual(codes(issues), ["child_over_adult", "date_without_price"]);
});

test("Санья: a live date without the hotel/package rows other dates have is an error", () => {
  const row = (date) => ({ date_keys: [date], hotel: "Phoenix Island 5*", package_id: "Хөтөлбөргүй", adult_price: 3290000 });
  const issues = checkTrip(trip({ sourceMetadata: { price_groups: [row("2026-10-01")] }, departures: [dep("2026-10-01", { status: "DEPARTED" }), dep("2026-11-04")] }), TODAY, NOW);
  assert.deepEqual(codes(issues), ["date_without_options"]);
});

test("a weekday in the title must match the bookable dates (Cyrillic, incl. Ням)", () => {
  assert.deepEqual(codes(checkTrip(trip({ title: "САНЬЯА-Лхагва", departures: [dep("2026-11-04")] }), TODAY, NOW)), []);
  assert.deepEqual(codes(checkTrip(trip({ title: "САНЬЯА-Лхагва", departures: [dep("2026-11-05")] }), TODAY, NOW)), ["weekday_mismatch"]);
  assert.deepEqual(codes(checkTrip(trip({ title: "Ням гарагийн аялал", departures: [dep("2026-11-08")] }), TODAY, NOW)), []);
  assert.deepEqual(codes(checkTrip(trip({ title: "Нямбуугийн аялал", departures: [dep("2026-11-04")] }), TODAY, NOW)), []);
});

test("a website edit stuck on its way to the chatbot is an error after 15 minutes", () => {
  const pending = (minutes) => trip({ sourceMetadata: { websiteSyncPending: { queuedAt: new Date(NOW - minutes * 60_000).toISOString() } } });
  assert.deepEqual(codes(checkTrip(pending(5), TODAY, NOW)), []);
  assert.deepEqual(codes(checkTrip(pending(30), TODAY, NOW)), ["sync_stuck"]);
});

test("a retried, stopped, conflicting or partly ignored sync is visible with its reason", () => {
  const meta = (sourceMetadata) => checkTrip(trip({ sourceMetadata }), TODAY, NOW);
  const queuedAt = new Date(NOW - 60 * 60_000).toISOString();
  const retrying = meta({ websiteSyncPending: { queuedAt, attempts: 3, lastError: { code: "timeout" } } });
  assert.match(retrying[0].message, /3 удаа оролдсон, алдаа: timeout/);
  const stopped = meta({ websiteSyncPending: { queuedAt, attempts: 10, failedAt: queuedAt, lastError: { code: "invalid_trip_sync_payload" } } });
  assert.match(stopped[0].message, /автомат оролдлого зогссон/);
  assert.deepEqual(codes(meta({ shared_conflicts: [{ field: "route_name" }, { field: "notes" }] })), ["sync_conflict"]);
  assert.deepEqual(codes(meta({ websiteSyncReport: { ignored: [{ field: "title", reason: "not_applied" }] } })), ["sync_field_ignored"]);
});

test("sold-out-only and duplicate published trips are warnings", () => {
  const issues = checkCatalog([trip({ departures: [dep("2026-11-04", { status: "SOLD_OUT" })] }), trip({ id: "t2", slug: "sanya-2" })], TODAY, NOW);
  assert.deepEqual(codes(issues), ["duplicate_title", "duplicate_title", "no_bookable_date"]);
  assert.ok(issues.every((issue) => issue.severity === "warning"));
});

test("GTC drift: a raised child fare and a missing date are reported", () => {
  const ours = trip({ sourceMetadata: { price_groups: [{ date_keys: ["2026-11-04"], hotel: "Phoenix Island + Paxton", package_id: "Хөтөлбөртэй", adult_price: 2990000,
    single_price: 650000, passenger_prices: [{ age_range: "6-11 нас", price: 2590000 }, { age_range: "2-5 нас", price: 2390000 }, { age_range: "0-2 нас", price: 450000 }] }] } });
  const fare = (date, child611) => ({ date, hotel: "Phoenix Island + Paxton", packageId: "Хөтөлбөртэй", adult: 2990000, child611, child25: 2390000, infant: 450000, single: 650000 });
  assert.deepEqual(comparePartnerFares(ours, "GTC", [fare("2026-11-04", 2590000)], TODAY), []);
  const issues = comparePartnerFares(ours, "GTC", [fare("2026-11-04", 2790000), fare("2026-11-11", 2790000), fare("2026-10-01", 1)], TODAY);
  assert.deepEqual(codes(issues), ["partner_date_missing", "partner_price_drift"]);
  assert.match(issues.find((i) => i.code === "partner_price_drift").message, /хүүхэд 6-11: манайд 2,590,000₮, GTC: 2,790,000₮/);
});
