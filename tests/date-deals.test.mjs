import assert from "node:assert/strict";
import test from "node:test";

import { applyDateDeals, dateDealInput, dealDeparture, effectiveSale, salePercentOf } from "../src/lib/dateDeals.ts";
import { brandTrip } from "../src/lib/brandPricing.ts";
import { startingPrice } from "../src/lib/departures.ts";
import { datePriceOptions } from "../src/lib/tripPriceOptions.ts";
import { priceTableBlocks } from "../src/lib/tripPriceTable.ts";
import { departureDigest } from "../src/lib/departureDigest.ts";
import { foldSave, syncSnapshot, deliveryPayload } from "../src/lib/tripSyncEdits.ts";
import { lineTotal, resolvePrices } from "../src/lib/pricing.ts";

// A sale and «Онцлох» on ONE departure date (2026-11-22). Invented trip, invented dates and prices.

// 2099-03-01, 11:00 in Ulaanbaatar.
const NOW = new Date("2099-03-01T03:00:00.000Z");
// Dates are stored at Ulaanbaatar midnight, as the imports store them.
const day = (iso) => new Date(`${iso}T00:00:00+08:00`).toISOString();

const departure = (id, iso, fields = {}) => ({
  id, tripId: "t-syn", label: null, startDate: day(iso), endDate: null, seatsTotal: null, seatsLeft: null,
  price: 3_000_000, childPrice: 2_000_000, infantPrice: 300_000, status: "OPEN",
  salePrice: null, saleChildPrice: null, isFeatured: false, ...fields,
});

const trip = (departures, fields = {}) => ({
  id: "t-syn", slug: "synthetic-tour", title: "Жишээ аялал", price: 3_000_000, childPrice: 2_000_000, infantPrice: 300_000,
  oldPrice: null, discount: 0, isFeatured: false, sourceMetadata: null, departures, ...fields,
});

test("a sale lower than the date's fare is what the customer pays, the regular fare kept beside it", () => {
  const out = applyDateDeals(trip([departure("d1", "2099-04-10", { price: 3_290_000, salePrice: 2_990_000 })]), NOW);
  const [d1] = out.departures;
  assert.equal(d1.price, 2_990_000);
  assert.equal(d1.originalPrice, 3_290_000);
  assert.equal(d1.salePercent, 9);
  assert.equal(salePercentOf(3_290_000, 2_990_000), 9);
});

test("a sale that is not lower than the regular fare (or is a placeholder) is ignored", () => {
  for (const salePrice of [3_000_000, 3_500_000, 0, -1, 1, Number.NaN, null]) {
    const input = departure("d1", "2099-04-10", { salePrice });
    const out = applyDateDeals(trip([input]), NOW);
    assert.equal(out.departures[0].price, 3_000_000, String(salePrice));
    assert.equal(out.departures[0].originalPrice, undefined, String(salePrice));
  }
  assert.equal(effectiveSale(3_000_000, 2_999_999), true);
  assert.equal(effectiveSale(null, 2_000_000), false, "no regular fare, nothing to compare with");
});

test("a date with no fare of its own is compared with the trip's fare", () => {
  const out = applyDateDeals(trip([departure("d1", "2099-04-10", { price: null, childPrice: null, salePrice: 2_700_000 })]), NOW);
  assert.equal(out.departures[0].price, 2_700_000);
  assert.equal(out.departures[0].originalPrice, 3_000_000);
  assert.equal(out.departures[0].salePercent, 10);
});

test("a child sale replaces the child fare on that date only; the adult fare stays", () => {
  const out = applyDateDeals(trip([
    departure("d1", "2099-04-10", { saleChildPrice: 1_800_000 }),
    departure("d2", "2099-04-17"),
  ]), NOW);
  assert.equal(out.departures[0].childPrice, 1_800_000);
  assert.equal(out.departures[0].originalChildPrice, 2_000_000);
  assert.equal(out.departures[0].price, 3_000_000);
  assert.equal(out.departures[0].originalPrice, undefined);
  assert.equal(out.departures[1].childPrice, 2_000_000);
});

test("estimates and bookings price a sale date at the sale fare and any other date at its regular fare", () => {
  const out = applyDateDeals(trip([
    departure("sale", "2099-04-10", { salePrice: 2_500_000, saleChildPrice: 1_500_000 }),
    departure("plain", "2099-04-17"),
  ]), NOW);
  const counts = { adults: 2, children: 1, infants: 0 };
  assert.equal(lineTotal(counts, resolvePrices(out, out.departures[0])), 2 * 2_500_000 + 1_500_000);
  assert.equal(lineTotal(counts, resolvePrices(out, out.departures[1])), 2 * 3_000_000 + 2_000_000);
  // The booking route deals the one departure it reads (server/booking.ts).
  const raw = departure("sale", "2099-04-10", { salePrice: 2_500_000 });
  assert.equal(resolvePrices(out, dealDeparture(raw, out)).adult, 2_500_000);
});

test("applying the deals twice changes nothing", () => {
  const input = trip([
    departure("d1", "2099-04-10", { salePrice: 2_400_000, saleChildPrice: 1_600_000, isFeatured: true }),
    departure("d2", "2099-05-10", { price: 3_200_000 }),
  ]);
  const once = applyDateDeals(input, NOW);
  const twice = applyDateDeals(once, NOW);
  assert.deepEqual(twice, once);
  assert.equal(dealDeparture(once.departures[0], once), once.departures[0], "a dealt date is left as it is");
  assert.equal(input.departures[0].price, 3_000_000, "the input is never mutated");
});

test("a trip with no deals comes back as the very same object", () => {
  const input = trip([departure("d1", "2099-04-10")]);
  assert.equal(applyDateDeals(input, NOW), input);
  const noDepartures = { id: "x", price: 1 };
  assert.equal(applyDateDeals(noDepartures, NOW), noDepartures);
});

test("«Онцлох» on an upcoming, bookable date features the trip and lists the date; past and closed dates do not", () => {
  const out = applyDateDeals(trip([
    departure("past", "2099-02-20", { isFeatured: true }),
    departure("today", "2099-03-01", { isFeatured: true }),
    departure("full", "2099-04-01", { isFeatured: true, status: "SOLD_OUT" }),
    departure("paused", "2099-04-02", { isFeatured: true, status: "PAUSED" }),
    departure("cancelled", "2099-04-03", { isFeatured: true, status: "CANCELLED" }),
    departure("no-seats", "2099-04-04", { isFeatured: true, seatsLeft: 0 }),
    departure("open", "2099-04-10", { isFeatured: true }),
    departure("plain", "2099-04-17"),
  ]), NOW);
  assert.equal(out.isFeatured, true);
  assert.deepEqual(out.featuredDates, ["2099-03-01", "2099-04-10"]);

  const onlyPast = applyDateDeals(trip([departure("past", "2099-02-20", { isFeatured: true }), departure("full", "2099-04-01", { isFeatured: true, status: "SOLD_OUT" })]), NOW);
  assert.equal(onlyPast.isFeatured, false);
  assert.equal(onlyPast.featuredDates, undefined);
});

test("a trip featured by staff stays featured with or without featured dates", () => {
  assert.equal(applyDateDeals(trip([departure("d1", "2099-04-10")], { isFeatured: true }), NOW).isFeatured, true);
});

test("the trip's badge is its deepest upcoming bookable date sale; past and full dates do not count", () => {
  const out = applyDateDeals(trip([
    departure("past", "2099-02-20", { salePrice: 1_500_000 }),
    departure("full", "2099-04-01", { salePrice: 1_800_000, status: "SOLD_OUT" }),
    departure("small", "2099-04-10", { salePrice: 2_850_000 }),
    departure("big", "2099-04-17", { salePrice: 2_700_000 }),
  ]), NOW);
  assert.equal(out.discount, 10);
  assert.equal(out.saleFromDates, true);
});

test("the old 'from' price is struck through only when the card's from-price is a sale date's fare", () => {
  // The cheapest date is on sale: the card reads 2,700,000₮ with 3,000,000₮ (the old from-price) struck.
  const cheapest = applyDateDeals(trip([
    departure("sale", "2099-04-10", { salePrice: 2_700_000 }),
    departure("dear", "2099-04-17", { price: 3_400_000 }),
  ]), NOW);
  assert.equal(startingPrice(cheapest, NOW.getTime()), 2_700_000);
  assert.equal(cheapest.oldPrice, 3_000_000);

  // The sale is on a dearer date and still costs more than the cheapest date: badge yes, struck price no.
  const dearSale = applyDateDeals(trip([
    departure("cheap", "2099-04-10", { price: 2_500_000 }),
    departure("sale", "2099-04-17", { price: 3_400_000, salePrice: 3_000_000 }),
  ]), NOW);
  assert.equal(dearSale.discount, 12);
  assert.equal(startingPrice(dearSale, NOW.getTime()), 2_500_000);
  assert.equal(dearSale.oldPrice, null);

  // The struck price is the old from-price, never more: a cheaper regular date caps it.
  const capped = applyDateDeals(trip([
    departure("sale", "2099-04-10", { price: 3_400_000, salePrice: 2_600_000 }),
    departure("regular", "2099-04-17", { price: 2_800_000 }),
  ]), NOW);
  assert.equal(startingPrice(capped, NOW.getTime()), 2_600_000);
  assert.equal(capped.oldPrice, 2_800_000);
});

test("a trip with its own sale keeps its own badge and old price", () => {
  const ownDiscount = applyDateDeals(trip([departure("d1", "2099-04-10", { salePrice: 2_000_000 })], { discount: 5, oldPrice: 3_150_000 }), NOW);
  assert.equal(ownDiscount.discount, 5);
  assert.equal(ownDiscount.oldPrice, 3_150_000);
  assert.equal(ownDiscount.saleFromDates, undefined);
  assert.equal(ownDiscount.departures[0].price, 2_000_000, "the date's sale still applies");

  const ownOldPrice = applyDateDeals(trip([departure("d1", "2099-04-10", { salePrice: 2_000_000 })], { oldPrice: 3_500_000 }), NOW);
  assert.equal(ownOldPrice.discount, 0);
  assert.equal(ownOldPrice.oldPrice, 3_500_000);
});

test("Magnai: old and new fares are both 50,000₮ lower, the percent is worked out from them", () => {
  const input = trip([
    departure("sale", "2099-04-10", { price: 3_290_000, salePrice: 2_990_000, saleChildPrice: 1_900_000 }),
    departure("dear", "2099-04-17", { price: 3_500_000 }),
  ], { summary: "Энгийн үнэ 3,290,000₮, хямдралтай 2,990,000₮" });
  // What brandPublicTrip does on a secondary brand (lib/brandTrip.ts).
  const shown = applyDateDeals(brandTrip(applyDateDeals(input, NOW), { discount: 50_000 }), NOW);
  const [sale, dear] = shown.departures;
  assert.equal(sale.price, 2_940_000);
  assert.equal(sale.originalPrice, 3_240_000);
  assert.equal(sale.salePrice, 2_940_000);
  assert.equal(sale.salePercent, Math.round((3_240_000 - 2_940_000) / 3_240_000 * 100));
  assert.equal(sale.childPrice, 1_850_000);
  assert.equal(sale.originalChildPrice, 1_950_000);
  assert.equal(dear.price, 3_450_000);
  assert.equal(dear.originalPrice, undefined);
  assert.equal(shown.oldPrice, 3_240_000, "the old from-price (the sale date's regular fare), lowered");
  assert.equal(shown.discount, sale.salePercent);
  assert.equal(shown.summary, "Энгийн үнэ 3,240,000₮, хямдралтай 2,940,000₮", "text repeating either fare follows");
});

test("Magnai: a sale that the lowered regular fare undercuts is dropped, the date sells at the lowered fare", () => {
  const input = trip([departure("d1", "2099-04-10", { price: 220_000, childPrice: null, salePrice: 190_000 })], { price: 220_000, childPrice: null });
  const shown = applyDateDeals(brandTrip(applyDateDeals(input, NOW), { discount: 50_000 }), NOW);
  assert.equal(shown.departures[0].price, 170_000);
  assert.equal(shown.departures[0].originalPrice, undefined);
  assert.equal(shown.departures[0].salePercent, undefined);
  assert.equal(shown.discount, null);
  assert.equal(shown.saleFromDates, undefined);
});

test("a staff-set old price is still left alone on Magnai", () => {
  const input = trip([departure("d1", "2099-04-10")], { oldPrice: 3_500_000, discount: 14 });
  const shown = applyDateDeals(brandTrip(applyDateDeals(input, NOW), { discount: 50_000 }), NOW);
  assert.equal(shown.oldPrice, 3_500_000);
  assert.equal(shown.discount, 14);
});

const groupTrip = (groups) => ({ sourceMetadata: { price_groups: groups } });

test("price rows of a sale date charge the sale fare: the row at the regular fare, and its child band", () => {
  const dealt = applyDateDeals(trip([departure("d1", "2099-04-10", { salePrice: 2_700_000, saleChildPrice: 1_700_000 })]), NOW).departures[0];
  const options = datePriceOptions(groupTrip([
    { date_keys: ["2099-04-10"], hotel: "Жишээ буудал A", adult_price: 3_000_000, currency: "MNT",
      passenger_prices: [{ label: "Хүүхэд", age_range: "2-11 нас", price: 2_000_000 }, { label: "Нярай", age_range: "0-2", price: 300_000 }] },
    { date_keys: ["2099-04-10"], hotel: "Жишээ буудал B", adult_price: 3_600_000, currency: "MNT" },
  ]), dealt);
  const [a, b] = options;
  assert.equal(a.adult, 2_700_000);
  assert.equal(a.originalAdult, 3_000_000);
  assert.deepEqual(a.passengers.map((band) => [band.price, band.originalPrice]), [[1_700_000, 2_000_000], [300_000, undefined]]);
  assert.equal(b.adult, 3_600_000, "a dearer hotel keeps its own fare: the sale was never set for it");
  assert.equal(b.originalAdult, undefined);
});

test("a date with one plain price row takes the sale even when the row's figure drifted from the date's", () => {
  const dealt = applyDateDeals(trip([departure("d1", "2099-04-10", { salePrice: 2_700_000 })]), NOW).departures[0];
  const [row] = datePriceOptions(groupTrip([{ date_keys: ["2099-04-10"], adult_price: 3_100_000, currency: "MNT", passenger_prices: [{ label: "Хүүхэд", price: 2_000_000 }] }]), dealt);
  assert.equal(row.adult, 2_700_000);
  assert.equal(row.originalAdult, 3_100_000);
});

test("a date without a sale reads its price rows exactly as before", () => {
  const plain = departure("d1", "2099-04-10");
  const groups = groupTrip([{ date_keys: ["2099-04-10"], adult_price: 3_000_000, currency: "MNT" }]);
  assert.deepEqual(datePriceOptions(groups, plain), datePriceOptions(groups, { startDate: plain.startDate }));
  assert.equal("originalAdult" in datePriceOptions(groups, plain)[0], false);
});

test("the price table never merges a sale date with a regular date of the same figure", () => {
  const dealt = applyDateDeals(trip([
    departure("sale", "2099-04-10", { price: 3_200_000, salePrice: 3_000_000 }),
    departure("plain", "2099-04-17", { price: 3_000_000 }),
  ]), NOW);
  const blocks = priceTableBlocks(groupTrip([
    { date_keys: ["2099-04-10"], hotel: "Жишээ буудал", adult_price: 3_200_000, currency: "MNT" },
    { date_keys: ["2099-04-17"], hotel: "Жишээ буудал", adult_price: 3_000_000, currency: "MNT" },
  ]), dealt.departures);
  assert.equal(blocks.length, 2);
});

test("the dates fingerprint changes with a deal and stays as it was for dates without one", () => {
  const plain = [departure("d1", "2099-04-10")];
  const legacy = { ...plain[0] };
  for (const field of ["salePrice", "saleChildPrice", "isFeatured"]) delete legacy[field];
  const before = departureDigest([legacy]);
  assert.equal(departureDigest(plain), before, "a date with no deal has the same fingerprint as before deals existed");
  const featured = departureDigest([departure("d1", "2099-04-10", { isFeatured: true })]);
  assert.notEqual(featured, before);
  const onSale = applyDateDeals(trip([departure("d1", "2099-04-10", { salePrice: 2_000_000 })]), NOW).departures;
  assert.notEqual(departureDigest(onSale), before);
});

test("a date's sale or «Онцлох» is never a staff edit for the chatbot, nor sent to it", () => {
  const base = { id: "t-syn", sourceTripId: "src-syn", sourceMetadata: {}, title: "Жишээ аялал", departures: [departure("d1", "2099-04-10")] };
  const onSale = { ...base, departures: [departure("d1", "2099-04-10", { salePrice: 2_500_000, saleChildPrice: 1_500_000, isFeatured: true })] };
  assert.deepEqual(foldSave({}, syncSnapshot(base), syncSnapshot(onSale)), {});
  const snapshot = syncSnapshot(onSale);
  for (const field of ["salePrice", "saleChildPrice", "isFeatured"]) assert.equal(field in snapshot.departures[0], false, field);
  // A real date edit alongside it is still one.
  const moved = { ...onSale, departures: [departure("d1", "2099-04-10", { salePrice: 2_500_000, status: "SOLD_OUT" })] };
  assert.deepEqual(Object.keys(foldSave({}, syncSnapshot(base), syncSnapshot(moved))), ["departures"]);
  // A queue entry that somehow carries them still never ships them.
  const payload = deliveryPayload({ trip: { ...base, departures: [{ ...base.departures[0], salePrice: 1 }] }, edits: {} });
  assert.equal("salePrice" in payload.trip.departures[0], false);
});

test("the trip save reads a date's sale and «Онцлох» only when the editor sends them; null or 0 clears", () => {
  const [untouched, cleared, set] = [
    { startDate: "2099-04-10", status: "OPEN", price: 3_000_000 },
    { startDate: "2099-04-17", status: "OPEN", salePrice: null, saleChildPrice: 0, isFeatured: false },
    { startDate: "2099-04-24", status: "OPEN", salePrice: "2700000", saleChildPrice: 1_700_000, isFeatured: true },
  ].map(dateDealInput);
  assert.deepEqual(untouched, {});
  assert.deepEqual([cleared.salePrice, cleared.saleChildPrice, cleared.isFeatured], [null, null, false]);
  assert.deepEqual([set.salePrice, set.saleChildPrice, set.isFeatured], [2_700_000, 1_700_000, true]);
});

test("uudamtravel.mn: every public read applies the date deals, and a trip without any is the same object", async () => {
  const { brandPublicTrip } = await import("../src/lib/brandTrip.ts");
  const plain = trip([departure("d1", "2099-04-10")]);
  assert.equal(brandPublicTrip(plain), plain);
  const shown = brandPublicTrip(trip([departure("d1", "2099-04-10", { salePrice: 2_700_000 })]));
  assert.deepEqual([shown.departures[0].price, shown.departures[0].originalPrice], [2_700_000, 3_000_000]);
});
