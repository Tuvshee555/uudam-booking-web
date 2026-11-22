import assert from "node:assert/strict";
import test from "node:test";

// The secondary brand's deployment (lib/brand.ts reads this when it loads), end to end through
// brandPublicTrip: date sales first, then the brand's lower fares. Invented trip, dates and prices.
process.env.NEXT_PUBLIC_BRAND = "magnai";
delete process.env.BRAND_DISCOUNT_MNT;
const { brandPublicTrip } = await import("../src/lib/brandTrip.ts");
const { BRAND_DISCOUNT_MNT } = await import("../src/lib/brand.ts");

const departure = (id, startDate, fields = {}) => ({
  id, tripId: "t-syn", label: null, startDate, endDate: null, seatsTotal: null, seatsLeft: null,
  price: 3_000_000, childPrice: 2_000_000, infantPrice: 300_000, status: "OPEN",
  salePrice: null, saleChildPrice: null, isFeatured: false, ...fields,
});

const trip = () => ({
  id: "t-syn", slug: "synthetic-tour", title: "Жишээ аялал", price: 3_000_000, childPrice: 2_000_000, infantPrice: 300_000,
  oldPrice: null, discount: 0, isFeatured: false, sourceMetadata: null,
  departures: [
    departure("sale", "2099-04-09T16:00:00.000Z", { price: 3_290_000, salePrice: 2_990_000, isFeatured: true }),
    departure("plain", "2099-04-16T16:00:00.000Z", { price: 3_400_000 }),
  ],
});

test("Magnai shows a date sale with both fares lowered and the percent from the lowered figures", () => {
  assert.equal(BRAND_DISCOUNT_MNT, 50_000);
  const shown = brandPublicTrip(trip());
  const [sale, plain] = shown.departures;
  assert.deepEqual([sale.price, sale.originalPrice, sale.salePercent], [2_940_000, 3_240_000, 9]);
  assert.deepEqual([plain.price, plain.originalPrice], [3_350_000, undefined]);
  assert.equal(shown.price, 2_950_000);
  assert.equal(shown.oldPrice, 3_240_000);
  assert.equal(shown.discount, 9);
  assert.equal(shown.isFeatured, true);
  assert.deepEqual(shown.featuredDates, ["2099-04-10"]);
});

test("Magnai's read of the same trip twice gives the same figures (nothing is discounted twice)", () => {
  const input = trip();
  assert.deepEqual(brandPublicTrip(input), brandPublicTrip(input));
  assert.equal(input.departures[0].price, 3_290_000);
});
