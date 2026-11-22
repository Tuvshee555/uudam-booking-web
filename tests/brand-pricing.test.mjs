import assert from "node:assert/strict";
import test from "node:test";

import { brandTrip, collectFares, discountFare, discountFaresInText, fareMap, isInfantShaped } from "../src/lib/brandPricing.ts";
import { brandDiscountFor, brandFor, renameBrandIn } from "../src/lib/brand.ts";

// A secondary brand (Magnai) shows the shared catalogue with every adult and child fare lower.
// Invented trip, invented prices.

const OFF = 50_000;

const trip = () => ({
  id: "trip-invented-1",
  slug: "invented-sample-tour",
  title: "Жишээ аялал",
  summary: "Том хүн 3,330,000₮-с эхэлнэ",
  price: 3_330_000,
  oldPrice: 3_500_000,
  childPrice: 2_220_000,
  infantPrice: 440_000,
  singleSupplement: 600_000,
  image: "https://res.cloudinary.com/demo/image/upload/v1/uudam-travel-trips/sample.jpg",
  childPriceNotes: ["Том хүн (12+ нас) - 3,330,000₮", "Хүүхэд (2-11 нас) - 2 220 000₮", "Нярай (0-2 нас) - 440,000₮"],
  roomPrices: ["Ганцаараа өрөө: +600,000₮"],
  extraFees: ["Виз 150,000₮"],
  brochurePdfUrl: "https://uudam-chatbot.vercel.app/api/poster-pdf?id=poster-invented",
  departures: [
    { id: "d1", startDate: "2099-01-10T00:00:00.000Z", price: 3_330_000, childPrice: 2_220_000, infantPrice: 440_000, label: null },
    { id: "d2", startDate: "2099-02-10T00:00:00.000Z", price: 3_280_000, childPrice: null, infantPrice: null, label: "Хямдралтай" },
  ],
  testimonials: [{ comment: "3,330,000₮-өөр явсан, гоё байлаа" }],
  sourceMetadata: {
    price_groups: [
      {
        id: "g1",
        label: "2099-01-10",
        note: "Эрт захиалбал 3.33 сая",
        currency: "MNT",
        adult_price: 3_330_000,
        child_price: 2_220_000,
        infant_price: 440_000,
        single_price: 600_000,
        adult_price_range: null,
        date_keys: ["2099-01-10"],
        passenger_prices: [
          { label: "Хүүхэд", age_range: "2-11 нас", price: 2_100_000, currency: "MNT", condition: "" },
          { label: "Нярай", age_range: "0-2 нас", price: 440_000, currency: "MNT", condition: "" },
        ],
        availability: { status: "available", seatsLeft: 12 },
      },
      { id: "g2", currency: "CNY", adult_price: 9_800, child_price: 7_000 },
    ],
    child_rules: [
      { label: "2-11 нас хүүхэд", price: 2_220_000, currency: "MNT", age_range: "2-11 нас", note: "" },
      { label: "0-2 нас хүүхэд/такс", price: 440_000, currency: "MNT", age_range: "0-2 нас", note: "" },
    ],
    extra_fees: [{ label: "Виз", amount: 3_330_000, currency: "MNT" }],
    infant_prices: [{ price: 440_000, currency: "MNT", age_range: "0-2" }],
    website_summary: "Үүдэм Трэвел-ийн аялал: 3,330,000₮",
    seats_left: 12,
  },
});

test("the discount only ever applies to a secondary brand", () => {
  assert.equal(brandDiscountFor(brandFor(undefined), "50000"), 0, "Uudam never discounts, even with the variable set");
  assert.equal(brandDiscountFor(brandFor("uudam"), "70000"), 0);
  assert.equal(brandDiscountFor(brandFor("magnai"), undefined), 50_000, "Magnai defaults to 50,000₮");
  assert.equal(brandDiscountFor(brandFor("MAGNAI"), "70000"), 70_000);
  assert.equal(brandDiscountFor(brandFor("magnai"), "nonsense"), 0, "a broken value discounts nothing rather than something random");
});

test("adult and child fares drop; infant, supplement, old price stay", () => {
  const out = brandTrip(trip(), { discount: OFF });
  assert.equal(out.price, 3_280_000);
  assert.equal(out.childPrice, 2_170_000);
  assert.equal(out.infantPrice, 440_000);
  assert.equal(out.singleSupplement, 600_000);
  assert.equal(out.oldPrice, 3_500_000);
  assert.deepEqual(out.departures.map((d) => [d.price, d.childPrice, d.infantPrice]), [[3_280_000, 2_170_000, 440_000], [3_230_000, null, null]]);
});

test("price groups: adult/child and child bands drop, infant bands and foreign-currency rows stay", () => {
  const out = brandTrip(trip(), { discount: OFF });
  const [group, cny] = out.sourceMetadata.price_groups;
  assert.equal(group.adult_price, 3_280_000);
  assert.equal(group.child_price, 2_170_000);
  assert.equal(group.infant_price, 440_000);
  assert.equal(group.single_price, 600_000);
  assert.deepEqual(group.passenger_prices.map((band) => band.price), [2_050_000, 440_000]);
  assert.equal(group.note, "Эрт захиалбал 3.28 сая", "a fare written in millions follows");
  assert.deepEqual(group.availability, { status: "available", seatsLeft: 12 });
  assert.deepEqual(cny, { id: "g2", currency: "CNY", adult_price: 9_800, child_price: 7_000 });
});

test("child rules: the child rule drops, the infant rule stays; fees and infant tables are untouched", () => {
  const meta = brandTrip(trip(), { discount: OFF }).sourceMetadata;
  assert.deepEqual(meta.child_rules.map((rule) => rule.price), [2_170_000, 440_000]);
  assert.deepEqual(meta.extra_fees, [{ label: "Виз", amount: 3_330_000, currency: "MNT" }], "a fee equal to a fare is still a fee");
  assert.deepEqual(meta.infant_prices, [{ price: 440_000, currency: "MNT", age_range: "0-2" }]);
  assert.equal(meta.seats_left, 12);
});

test("text: only the trip's own adult/child fares change, in their own formatting", () => {
  const out = brandTrip(trip(), { discount: OFF });
  assert.deepEqual(out.childPriceNotes, ["Том хүн (12+ нас) - 3,280,000₮", "Хүүхэд (2-11 нас) - 2 170 000₮", "Нярай (0-2 нас) - 440,000₮"]);
  assert.deepEqual(out.roomPrices, ["Ганцаараа өрөө: +600,000₮"]);
  assert.deepEqual(out.extraFees, ["Виз 150,000₮"]);
  assert.equal(out.summary, "Том хүн 3,280,000₮-с эхэлнэ");
  assert.deepEqual(out.testimonials, trip().testimonials, "a customer's own words are never edited");
});

test("a fare discounted once is never discounted again, and the input is not mutated", () => {
  // d2's original fare equals d1's discounted fare: a second pass must not touch it.
  const input = trip();
  const snapshot = JSON.parse(JSON.stringify(input));
  const out = brandTrip(input, { discount: OFF });
  assert.deepEqual(input, snapshot, "the cached input object is left exactly as it was");
  assert.equal(out.departures[0].price, 3_280_000);
  assert.equal(out.departures[1].price, 3_230_000);
  assert.equal(discountFaresInText("3,330,000 / 3,280,000", fareMap(input, OFF)), "3,280,000 / 3,230,000", "one pass per figure");
});

test("nothing to do returns the very same object (the primary brand is untouched)", () => {
  const input = trip();
  assert.equal(brandTrip(input, { discount: 0 }), input);
});

test("names and own links are rewritten only through the supplied hooks; photo URLs stay", () => {
  const magnai = brandFor("magnai");
  const out = brandTrip(trip(), {
    discount: OFF,
    rename: (text) => renameBrandIn(text, magnai, "https://magnai.example"),
    rewriteUrl: (url) => url.replace("https://uudam-chatbot.vercel.app", "https://bot.magnai.example"),
  });
  assert.equal(out.sourceMetadata.website_summary, "Магнай Травел-ийн аялал: 3,280,000₮");
  assert.equal(out.brochurePdfUrl, "https://bot.magnai.example/api/poster-pdf?id=poster-invented");
  assert.equal(out.image, trip().image, "a Cloudinary folder named after the old brand keeps working");
  assert.equal(out.slug, "invented-sample-tour");
});

test("infant detection follows the age, not the word «хүүхэд»", () => {
  for (const infant of ["Нярай", "0-2 нас хүүхэд", "0–3 нас", "2 хүртэлх", "2-оос доош", "24 сар хүртэл", "infant"]) {
    assert.equal(isInfantShaped(infant), true, infant);
  }
  for (const child of ["Хүүхэд", "2-11 нас хүүхэд", "Том хүн", "12+ нас", "6-аас доош", "Хүүхэд (1,2–1,4 м өндөр)", "10 сарын 8-ны үнэ", "2099 оны үнэ"]) {
    assert.equal(isInfantShaped(child), false, child);
  }
});

test("money in text: dates, phone numbers and other amounts are never read as a fare", () => {
  const fares = new Map([[3_330_000, 3_280_000], [1_500_000, 1_450_000]]);
  assert.equal(discountFaresInText("2099.10.08-нд, утас 9911 2233", fares), "2099.10.08-нд, утас 9911 2233");
  assert.equal(discountFaresInText("13,330,000₮ ба 3,330,0001", fares), "13,330,000₮ ба 3,330,0001");
  assert.equal(discountFaresInText("3330000₮, 3.330.000₮, 3 330 000₮, 1,5 сая", fares), "3280000₮, 3.280.000₮, 3 280 000₮, 1,45 сая");
  assert.equal(discountFare(150_000, OFF), 150_000, "a figure under 200,000₮ is not a package fare");
});

test("collectFares sees fares in every place the catalogue keeps them", () => {
  const { adultChild, infant } = collectFares(trip());
  assert.deepEqual([...adultChild].sort(), [2_100_000, 2_220_000, 3_280_000, 3_330_000].sort());
  assert.deepEqual([...infant], [440_000]);
});
