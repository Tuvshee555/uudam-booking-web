import assert from "node:assert/strict";
import test from "node:test";

import { destinationTiles, heroSlides, nextDeparturesByTrip, openDepartureCount } from "../src/lib/homeSections.ts";

const now = Date.UTC(2026, 9, 31, 4, 0);
const departure = (id, startDate, extra = {}) => ({
  id, tripId: id, label: null, startDate, endDate: null, seatsTotal: null, seatsLeft: null,
  price: null, childPrice: null, infantPrice: null, status: "OPEN", ...extra,
});
const trip = (slug, extra = {}) => ({
  id: slug, slug, title: "Аялал", summary: null, country: null, city: null, destinations: [], durationDays: 8,
  price: 3_000_000, image: `https://res.cloudinary.com/x/image/upload/${slug}.jpg`, departures: [], categoryId: null,
  categories: [], tags: [], isFeatured: false, createdAt: "2026-10-01T00:00:00.000Z", discount: null, sourceMetadata: null,
  ...extra,
});

test("hero: featured trips first, then the curated covers; never a trip that is gone", () => {
  const bali = trip("trip-ade46028fe74797d2eb7", { title: "БАЛИ АРЛЫН АЯЛАЛ" });
  const featured = trip("featured", { isFeatured: true, title: "Япон" });
  const other = trip("other");
  const slides = heroSlides([other, bali, featured], now);
  assert.deepEqual(slides.map((slide) => slide.trip?.slug), ["featured", "trip-ade46028fe74797d2eb7"]);
  assert.equal(slides[1].trip.place, "Бали");
});

test("hero: staff-chosen photos win, captioned only when they are a live trip's cover", () => {
  const bali = trip("bali", { title: "БАЛИ" });
  const slides = heroSlides([bali], now, [bali.image, "https://res.cloudinary.com/x/image/upload/elsewhere.jpg"]);
  assert.equal(slides[0].trip?.slug, "bali");
  assert.equal(slides[1].trip, null);
});

test("hero: the caption carries the trip's own nights, not just its days", () => {
  const long = trip("long", { title: "Норвел", durationDays: 9, durationNights: 7, isFeatured: true });
  const [slide] = heroSlides([long], now);
  assert.equal(slide.trip.durationDays, 9);
  assert.equal(slide.trip.durationNights, 7);
  assert.equal(heroSlides([trip("old", { isFeatured: true })], now)[0].trip.durationNights, 0, "a trip with no nights stored has none");
});

test("departures: one row per trip, soonest first, only open dates", () => {
  const a = trip("a", { departures: [departure("a1", "2026-11-20T16:00:00.000Z"), departure("a2", "2026-11-05T16:00:00.000Z", { status: "SOLD_OUT" })] });
  const b = trip("b", { departures: [departure("b1", "2026-11-10T16:00:00.000Z", { price: 2_000_000 }), departure("b2", "2026-11-12T16:00:00.000Z")] });
  const rows = nextDeparturesByTrip([a, b], now);
  assert.deepEqual(rows.map((row) => row.departure.id), ["b1", "a1"]);
  assert.equal(rows[0].price, 2_000_000, "the price of that date, not the base fare");
  assert.equal(openDepartureCount([a, b], now, 60), 3);
});

test("destination tiles: bookable places first, photos never repeat or reuse the hero", () => {
  const hainanA = trip("ha", { title: "ХАЙНАН – ТАВРИН", departures: [departure("x", "2026-11-10T16:00:00.000Z"), departure("y", "2026-11-20T16:00:00.000Z")] });
  const hainanB = trip("hb", { title: "хайнан-хайкоу", departures: [departure("z", "2026-12-10T16:00:00.000Z")] });
  const egypt = trip("eg", { title: "ЕГИПЕТ", departures: [departure("e", "2026-12-04T16:00:00.000Z")] });
  const tiles = destinationTiles([egypt, hainanA, hainanB], now, 7, [hainanA.image]);
  assert.deepEqual(tiles.map((tile) => tile.destination.key), ["hainan", "egypt"]);
  assert.equal(tiles[0].image, hainanB.image, "the hero already shows hainanA's cover");
  assert.equal(tiles[0].count, 2);
});
