import assert from "node:assert/strict";
import test from "node:test";

import {
  catalogFacets,
  emptyFilters,
  filtersFromParams,
  filtersToQuery,
  sortTrips,
  tripMatches,
} from "../src/lib/catalogFilters.ts";

const now = Date.UTC(2026, 9, 31, 4, 0);
const departure = (id, startDate, extra = {}) => ({
  id, tripId: "t", label: null, startDate, endDate: null, seatsTotal: null, seatsLeft: null,
  price: null, childPrice: null, infantPrice: null, status: "OPEN", ...extra,
});
const trip = (id, extra = {}) => ({
  id,
  title: "Аялал",
  summary: null,
  country: null,
  city: null,
  destinations: [],
  durationDays: 8,
  price: 3_000_000,
  departures: [],
  categoryId: null,
  categories: [],
  tags: [],
  isFeatured: false,
  createdAt: "2026-10-01T00:00:00.000Z",
  discount: null,
  sourceMetadata: null,
  ...extra,
});

const hainan = trip("hainan", {
  title: "ХАЙНАН – САНЬЯА АЯЛАЛ",
  durationDays: 9,
  categoryId: "flight",
  departures: [
    departure("h1", "2026-11-12T16:00:00.000Z", { price: 3_090_000 }),
    departure("h2", "2026-12-03T16:00:00.000Z", { price: 2_890_000 }),
  ],
});
const phuket = trip("phuket", {
  title: "ТАЙЛАНД — ПУКЕТ АЯЛАЛ",
  price: 5_990_000,
  departures: [departure("p1", "2026-12-05T16:00:00.000Z", { price: 5_790_000 })],
});
const soldOut = trip("sold", {
  title: "Япон Токио, Фүжи аялал",
  durationDays: 6,
  departures: [departure("j1", "2026-11-05T16:00:00.000Z", { status: "SOLD_OUT" })],
});
const past = trip("past", {
  title: "ЕГИПЕТ шууд нислэгтэй аялал",
  departures: [departure("e1", "2026-10-01T16:00:00.000Z")],
});
const all = [hainan, phuket, soldOut, past];

test("search tolerates case, Latin names and missing Mongolian letters", () => {
  assert.ok(tripMatches(hainan, { ...emptyFilters(), q: "sanya" }, now));
  assert.ok(tripMatches(soldOut, { ...emptyFilters(), q: "фужи" }, now));
  assert.ok(!tripMatches(phuket, { ...emptyFilters(), q: "япон" }, now));
});

test("a month only matches a date that is still open", () => {
  const filters = { ...emptyFilters(), months: ["2026-11"] };
  assert.deepEqual(all.filter((item) => tripMatches(item, filters, now)).map((item) => item.id), ["hainan"]);
});

test("available drops sold-out and past-only trips", () => {
  const filters = { ...emptyFilters(), available: true };
  assert.deepEqual(all.filter((item) => tripMatches(item, filters, now)).map((item) => item.id), ["hainan", "phuket"]);
});

test("price filters use the cheapest open date, not the base fare", () => {
  const filters = { ...emptyFilters(), price: "2m-4m" };
  assert.ok(tripMatches(hainan, filters, now), "2,890,000 is the cheapest open date");
  assert.ok(!tripMatches(phuket, filters, now));
});

test("sorting by price puts unpriced trips last and soonest uses open dates", () => {
  const unpriced = trip("unpriced", { price: 0 });
  assert.deepEqual(sortTrips([phuket, unpriced, hainan], "price-asc", now).map((item) => item.id), ["hainan", "phuket", "unpriced"]);
  assert.deepEqual(sortTrips([phuket, soldOut, hainan], "soonest", now).map((item) => item.id), ["hainan", "phuket", "sold"]);
});

test("facet counts ignore the facet's own selection", () => {
  const facets = catalogFacets(all, { ...emptyFilters(), destinations: ["thailand"] }, now, {
    categories: new Map([["flight", "Шууд нислэгтэй"]]),
    tags: new Map(),
    month: (key) => key,
  });
  const destinations = Object.fromEntries(facets.destinations.map((option) => [option.key, option.count]));
  assert.equal(destinations.hainan, 1, "Hainan still shows its own count while Thailand is picked");
  assert.equal(destinations.thailand, 1);
  assert.deepEqual(facets.months.map((option) => option.key), ["2026-12"], "only Thailand's open month remains");
});

test("URL round trip, including the parameter names old links used", () => {
  const legacy = filtersFromParams(new URLSearchParams("category=c1&duration=8%2B&featured=true&sale=true&sort=price-asc"));
  assert.deepEqual(legacy.categories, ["c1"]);
  assert.deepEqual(legacy.durations, ["long"]);
  assert.equal(legacy.featured, true);
  assert.equal(legacy.sort, "price-asc");
  const query = filtersToQuery({ ...emptyFilters(), q: "Хайнан", destinations: ["hainan"], months: ["2026-12"], available: true });
  assert.deepEqual(filtersFromParams(new URLSearchParams(query)), { ...emptyFilters(), q: "Хайнан", destinations: ["hainan"], months: ["2026-12"], available: true });
});
