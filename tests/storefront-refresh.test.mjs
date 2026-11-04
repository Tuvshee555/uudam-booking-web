import assert from "node:assert/strict";
import test from "node:test";

import { departureDigest } from "../src/lib/departureDigest.ts";
import { menuFieldsChanged } from "../src/lib/siteNav.ts";

const dates = [
  { id: "b", tripId: "t", label: null, startDate: "2027-03-10T00:00:00.000Z", endDate: "2027-03-15T00:00:00.000Z", seatsTotal: 20, seatsLeft: 4, price: 2390000, childPrice: null, infantPrice: null, status: "OPEN" },
  { id: "a", tripId: "t", label: "Цагаан сар", startDate: "2027-02-01T00:00:00.000Z", endDate: null, seatsTotal: null, seatsLeft: null, price: null, childPrice: 1900000, infantPrice: 0, status: "ALMOST_FULL" },
];

test("the page and the server agree on a trip's dates however the database orders them", () => {
  assert.equal(departureDigest(dates), departureDigest([...dates].reverse()));
  // The page carries JSON; the server serialises Prisma rows the same way.
  assert.equal(departureDigest(JSON.parse(JSON.stringify(dates))), departureDigest(dates));
  // A field the page never had and one it had as null are the same thing.
  assert.equal(departureDigest([{ ...dates[0], label: undefined }, dates[1]]), departureDigest(dates));
});

test("any change to a date a visitor could see changes the fingerprint", () => {
  const base = departureDigest(dates);
  for (const change of [{ seatsLeft: 0 }, { status: "SOLD_OUT" }, { price: 2490000 }, { startDate: "2027-03-11T00:00:00.000Z" }, { childPrice: 1000 }]) {
    assert.notEqual(departureDigest([{ ...dates[0], ...change }, dates[1]]), base, JSON.stringify(change));
  }
  assert.notEqual(departureDigest([dates[0]]), base, "a date removed");
});

const trip = {
  isPublished: true,
  title: "Хайнань 7 хоног",
  country: "Хятад",
  city: "Санья",
  destinations: ["Санья", "Хайкоу"],
  categoryId: "asia",
  categories: [{ id: "asia" }, { id: "sea" }],
};

test("only edits the menu shows refresh every page", () => {
  assert.equal(menuFieldsChanged(trip, { ...trip }), false);
  assert.equal(menuFieldsChanged(trip, { ...trip, destinations: ["Хайкоу", "Санья"], categories: [{ id: "sea" }, { id: "asia" }] }), false, "order alone");
  assert.equal(menuFieldsChanged(trip, { ...trip, isPublished: false }), true, "withdrawn");
  assert.equal(menuFieldsChanged(null, trip), true, "new and published");
  assert.equal(menuFieldsChanged(null, { ...trip, isPublished: false }), false, "new draft");
  assert.equal(menuFieldsChanged({ ...trip, isPublished: false }, { ...trip, isPublished: false, title: "Өөр" }), false, "draft edited");
  assert.equal(menuFieldsChanged(trip, { ...trip, title: "Бали 7 хоног" }), true, "destinations come from the title too");
  assert.equal(menuFieldsChanged(trip, { ...trip, categories: [{ id: "asia" }] }), true, "category removed");
  assert.equal(menuFieldsChanged(trip, { ...trip, city: "Хайкоу" }), true, "city");
});
