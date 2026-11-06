import assert from "node:assert/strict";
import test from "node:test";

import { asksForDates, asksToBook, describeOffer, questionMonth, searchTrips, tripOffer } from "../src/lib/tripAdvisor.ts";

const now = Date.UTC(2026, 10, 4, 4, 0); // 2026-11-04 in Ulaanbaatar
const dep = (id, startDate, extra = {}) => ({ id, startDate: new Date(`${startDate}T00:00:00.000Z`), price: null, status: "OPEN", seatsLeft: null, ...extra });
const trip = (id, title, extra = {}) => ({
  id, slug: id, title, summary: null, price: 2_890_000, image: "", country: null, city: null, destinations: [],
  durationDays: 8, departures: [], category: null, categories: [], ...extra,
});

const hainan = trip("hainan", "хайнан-хайкоу нислэгтэй - Мягмар гариг", {
  departures: [
    dep("past", "2026-11-03", { price: 2_890_000, status: "CANCELLED" }),
    dep("full", "2026-11-24", { price: 2_890_000, status: "SOLD_OUT" }),
    dep("d1", "2026-12-01", { price: 2_950_000 }),
    dep("d2", "2026-12-08", { price: 2_890_000 }),
    dep("d3", "2026-12-15", { price: 3_790_000 }),
    dep("d4", "2026-12-22", { price: 2_890_000 }),
  ],
});
const japan = trip("japan", "Япон Токио, Фүжи аялал", { price: 3_590_000, durationDays: 6, departures: [dep("j1", "2026-12-20", { price: 3_590_000 })] });
const paused = trip("paused", "ХАЙНАН АРЛЫН АЯЛАЛ", { price: 0, departures: [dep("p1", "2026-12-05", { status: "PAUSED" })] });

test("the advisor quotes the same starting price and next open dates as the trip page", () => {
  const offer = tripOffer(hainan, now);
  assert.equal(offer.fromPrice, 2_890_000, "cheapest OPEN date, not the sold-out or cancelled one");
  assert.deepEqual(offer.nextDepartures.map((entry) => [entry.date, entry.price]), [["2026-12-01", 2_950_000], ["2026-12-08", 2_890_000], ["2026-12-15", 3_790_000]]);
  assert.equal(offer.openCount, 4);
  assert.equal(offer.nextDepartures[0].label, "12-р сарын 1");
});

test("a price change on a date is what the advisor says next", () => {
  const changed = { ...hainan, departures: hainan.departures.map((d) => d.id === "d1" ? { ...d, price: 3_050_000 } : d) };
  assert.equal(tripOffer(changed, now).nextDepartures[0].price, 3_050_000);
  const removed = { ...hainan, departures: hainan.departures.filter((d) => d.id !== "d1") };
  assert.equal(tripOffer(removed, now).nextDepartures[0].date, "2026-12-08");
});

test("Mongolian, inflected and Latin spellings all find the Hainan trips", () => {
  for (const question of ["Хайнан аяллын дараагийн гаралт хэзээ вэ?", "хайнаны үнэ хэд вэ", "Hainan trip price", "санья явмаар байна", "хайнань 12 сард"]) {
    const ids = searchTrips(question, [hainan, japan, paused], now).map((entry) => entry.trip.id);
    assert.ok(ids.includes("hainan"), `${question} -> ${ids.join(",")}`);
    assert.ok(!ids.includes("japan") || ids.indexOf("hainan") < ids.indexOf("japan"), `${question}: Hainan ranks above Japan`);
  }
});

test("a month only counts for dates still open", () => {
  const ids = searchTrips("12 сард хайнан явах уу", [hainan, japan, paused], now).map((entry) => entry.trip.id);
  assert.equal(ids[0], "hainan");
});

test("date and booking questions are recognised, and the written reply never confirms a booking", () => {
  assert.ok(asksForDates("Дараагийн гаралт хэзээ вэ"));
  assert.ok(!asksForDates("үнэ хэд вэ"));
  assert.ok(asksToBook("2 хүн захиалъя"));
  assert.ok(asksToBook("төлбөрөө төлье"));
  const line = describeOffer(hainan, tripOffer(hainan, now));
  assert.match(line, /2,890,000₮-с эхэлнэ/);
  assert.match(line, /12-р сарын 1 \(2,950,000₮\)/);
  assert.match(line, /\+1 огноо/);
  assert.match(describeOffer(paused, tripOffer(paused, now)), /нээлттэй огноо алга/);
});

test("the advisor states a trip's length as the site does: days and the trip's own nights", () => {
  assert.match(describeOffer(hainan, tripOffer(hainan, now)), / — 8 өдөр, /);
  const nights = trip("nights", "Норвел аялал", { durationDays: 9, durationNights: 7 });
  assert.match(describeOffer(nights, tripOffer(nights, now)), / — 9 өдөр 7 шөнө, /);
  assert.doesNotMatch(describeOffer(nights, tripOffer(nights, now)), /хоног/);
});

test("'cheap' with a named place stays on that place; without one it is the whole catalog", () => {
  const cheapElsewhere = trip("cheap", "ЭРЭЭН – БЭЭЖИН аялал", { price: 990_000, departures: [dep("c1", "2026-12-12", { price: 990_000 })] });
  const named = searchTrips("Хайнань 12 сард хямд аялал байна уу", [hainan, japan, paused, cheapElsewhere], now).map((entry) => entry.trip.id);
  assert.equal(named[0], "hainan", named.join(","));
  assert.ok(!named.includes("cheap"));
  const anywhere = searchTrips("хамгийн хямд аялал", [hainan, japan, cheapElsewhere], now).map((entry) => entry.trip.id);
  assert.equal(anywhere[0], "cheap");
});

test("a month in the question brings that month's dates first", () => {
  assert.equal(questionMonth("12 сард явмаар байна"), 12);
  assert.equal(questionMonth("арван хоёрдугаар сар"), 12);
  const offer = tripOffer(hainan, now, 3, 12);
  assert.deepEqual(offer.nextDepartures.map((entry) => entry.date), ["2026-12-01", "2026-12-08", "2026-12-15"]);
  const january = trip("jan", "Хайнан 1 сар", { departures: [dep("n1", "2026-12-20", { price: 1 }), dep("n2", "2027-01-05", { price: 2 })] });
  assert.deepEqual(tripOffer(january, now, 3, 1).nextDepartures.map((entry) => entry.date), ["2027-01-05", "2026-12-20"]);
});
