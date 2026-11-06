import assert from "node:assert/strict";
import test from "node:test";

import { blockForDay, formatDayList, priceTableBlocks } from "../src/lib/tripPriceTable.ts";

// Invented hotels, packages and prices only — never a catalogue trip.
const PACKAGES = [{ id: "Хөтөлбөргүй", label: "Хөтөлбөргүй" }, { id: "Хөтөлбөртэй", label: "Хөтөлбөртэй" }];

const departure = (day, extra = {}) => ({
  id: `dep-${day}`, tripId: "t", label: null, startDate: `${day}T00:00:00.000Z`, endDate: null,
  seatsTotal: null, seatsLeft: null, price: null, childPrice: null, infantPrice: null, status: "OPEN", ...extra,
});

const row = (day, hotel, adult, extra = {}) => ({
  hotel, label: day, dates: [day], date_keys: [day], adult_price: adult,
  passenger_prices: [
    { label: "Хүүхэд 6-11 нас", age_range: "6-11 нас", price: adult - 100000 },
    { label: "Нярай 0-2 нас", age_range: "0-2 нас", price: 111111 },
  ],
  ...extra,
});

function variants(day, base) {
  return [
    row(day, "Сарнай Резорт · Хөтөлбөртэй", base + 400000, { single_price: 222222 }),
    row(day, "Норвел Бэй+Сарнай Резорт · Хөтөлбөргүй", base, { single_price: 111111 }),
    row(day, "Норвел Бэй+Сарнай Резорт · Хөтөлбөртэй", base + 300000, { single_price: 111111 }),
    row(day, "Сарнай Резорт · Хөтөлбөргүй", base + 100000, { single_price: 222222 }),
  ];
}

const trip = {
  sourceMetadata: {
    package_options: PACKAGES,
    price_groups: [
      ...variants("2099-03-04", 1111111),
      ...variants("2099-03-11", 1111111),
      ...variants("2099-03-18", 1555555),
      ...variants("2099-03-25", 1111111),
    ],
  },
};

test("dates with identical prices share one block; a different price season gets its own", () => {
  const departures = ["2099-03-04", "2099-03-11", "2099-03-18", "2099-03-25"].map((day) => departure(day));
  const blocks = priceTableBlocks(trip, departures);
  assert.deepEqual(blocks.map((block) => block.days), [["2099-03-04", "2099-03-11", "2099-03-25"], ["2099-03-18"]]);
  assert.equal(blocks[0].fromAdult, 1111111);
  assert.equal(blocks[1].fromAdult, 1555555);
  assert.equal(blockForDay(blocks, "2099-03-18")?.key, blocks[1].key);
  assert.equal(blockForDay(blocks, "2099-04-01"), null);
});

test("each block lists every hotel × package, cheapest hotel first, packages in the trip's order", () => {
  const [block] = priceTableBlocks(trip, [departure("2099-03-04")]);
  assert.deepEqual(block.rows.map((entry) => [entry.hotel, entry.packageId, entry.adult]), [
    ["Норвел Бэй+Сарнай Резорт", "Хөтөлбөргүй", 1111111],
    ["Норвел Бэй+Сарнай Резорт", "Хөтөлбөртэй", 1411111],
    ["Сарнай Резорт", "Хөтөлбөргүй", 1211111],
    ["Сарнай Резорт", "Хөтөлбөртэй", 1511111],
  ]);
  assert.deepEqual(block.bands.map((band) => band.label), ["Хүүхэд 6-11 нас", "Нярай 0-2 нас"]);
  assert.equal(block.showHotel, true);
  assert.equal(block.showPackage, true);
  assert.equal(block.showSingle, true);
  assert.equal(block.rows[0].singleSupplement, 111111);
  assert.equal(block.rows[2].singleSupplement, 222222, "each hotel keeps its own single supplement");
});

test("dates nobody can book are left out; a sold-out variant stays in, flagged", () => {
  const sold = {
    sourceMetadata: {
      package_options: PACKAGES,
      price_groups: [
        row("2099-03-04", "Altara", 1111111, { availability: { status: "sold_out" } }),
        row("2099-03-04", "Норвел Бэй", 1222222),
        row("2099-03-11", "Altara", 1111111),
      ],
    },
  };
  const blocks = priceTableBlocks(sold, [departure("2099-03-04"), departure("2099-03-11", { status: "SOLD_OUT" })]);
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0].rows.map((entry) => [entry.hotel, entry.available]), [["Altara", false], ["Норвел Бэй", true]]);
  assert.equal(blocks[0].fromAdult, 1222222, "the heading's 'from' price is a bookable one");
});

test("a band one row lacks is still a column, and a trip without hotels hides the hotel column", () => {
  const plain = { sourceMetadata: { price_groups: [
    { package_id: "A", dates: ["2099-03-04"], adult_price: 1111111, passenger_prices: [{ label: "Хүүхэд 2-5 нас", price: 900000 }] },
    { package_id: "B", dates: ["2099-03-04"], adult_price: 1222222 },
  ] } };
  const [block] = priceTableBlocks(plain, [departure("2099-03-04")]);
  assert.equal(block.showHotel, false);
  assert.equal(block.showPackage, true);
  assert.equal(block.showSingle, false);
  assert.deepEqual(block.bands.map((band) => band.label), ["Хүүхэд 2-5 нас"]);
  assert.equal(block.rows[1].passengers.length, 0);
});

test("a row's note keeps two otherwise equal dates apart, so it is never shown on the wrong date", () => {
  const noted = { sourceMetadata: { price_groups: [
    row("2099-03-04", "Altara", 1111111, { note: "Эрт захиалга" }),
    row("2099-03-11", "Altara", 1111111),
  ] } };
  const blocks = priceTableBlocks(noted, [departure("2099-03-04"), departure("2099-03-11")]);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].rows[0].note, "Эрт захиалга");
});

test("a placeholder fare is never the block's 'from' price", () => {
  const placeholder = { sourceMetadata: { price_groups: [
    row("2099-03-04", "Altara", 1111111, { adult_price: 0 }),
    row("2099-03-04", "Норвел Бэй", 1222222),
    row("2099-03-11", "Altara", 1111111, { adult_price: 1 }),
  ] } };
  const blocks = priceTableBlocks(placeholder, [departure("2099-03-04"), departure("2099-03-11")]);
  assert.equal(blocks[0].fromAdult, 1222222, "the 0₮ row is skipped, the real fare stays");
  assert.equal(blocks[0].rows.find((entry) => entry.hotel === "Altara")?.adult, null);
  assert.equal(blocks[1].fromAdult, null, "a date with only a 1₮ placeholder has no 'from' price");
});

test("a poster date text stamped on every row keeps equal dates in one block and is never shown", () => {
  // Two poster rows with the same fares but their own date texts (two date groups).
  const stamped = { sourceMetadata: { price_groups: [
    row("2099-03-04", "Altara", 1111111, { label: "3 сарын 04" }),
    row("2099-03-11", "Altara", 1111111, { label: "3 сарын 11, 3 сарын 18" }),
  ] } };
  const blocks = priceTableBlocks(stamped, [departure("2099-03-04"), departure("2099-03-11")]);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].rows[0].rowLabel, "");
});

test("bands that differ only by a height condition are their own columns, each row's fare found by key", () => {
  const short = (price) => ({ label: "Хүүхэд (1,0–1,2 м өндөр)", age_range: "", condition: "1,0–1,2 м өндөр", price });
  const tall = (price) => ({ label: "Хүүхэд", age_range: "", condition: "1,2–1,4 м өндөр", price });
  const heights = { sourceMetadata: { price_groups: [
    row("2099-03-04", "Altara", 2111111, { passenger_prices: [short(1111111), tall(1333333)] }),
    // This row prices only the taller child: the shorter child's column reads "—", never this fare.
    row("2099-03-04", "Норвел Бэй", 2222222, { passenger_prices: [tall(1444444)] }),
  ] } };
  const [block] = priceTableBlocks(heights, [departure("2099-03-04")]);
  assert.deepEqual(block.bands.map((band) => [band.label, band.condition]), [
    ["Хүүхэд (1,0–1,2 м өндөр)", "1,0–1,2 м өндөр"],
    ["Хүүхэд (1,2–1,4 м өндөр)", "1,2–1,4 м өндөр"],
  ]);
  assert.equal(new Set(block.bands.map((band) => band.key)).size, 2);
  const cells = block.rows.map((entry) => block.bands.map((band) => entry.passengers.find((fare) => fare.key === band.key)?.price ?? null));
  assert.deepEqual(cells, [[1111111, 1333333], [null, 1444444]]);
});

test("a band listed twice in a row is one column, not two", () => {
  const twice = { sourceMetadata: { price_groups: [row("2099-03-04", "Altara", 2111111, { passenger_prices: [
    { label: "Хүүхэд 2-4 нас", age_range: "2-4 нас", price: 1111111 },
    { label: "Хүүхэд 2-4 нас", age_range: "2-4 нас", price: 1111111 },
  ] })] } };
  const [block] = priceTableBlocks(twice, [departure("2099-03-04")]);
  assert.deepEqual(block.bands.map((band) => band.label), ["Хүүхэд 2-4 нас"]);
  assert.equal(block.rows[0].passengers.length, 1);
});

test("block dates read by month, naming any year other than this one", () => {
  assert.equal(formatDayList(["2099-03-25", "2099-03-04", "2099-04-01"], 2099), "3-р сарын 4, 25 · 4-р сарын 1");
  assert.equal(formatDayList(["2099-12-30", "2100-01-06"], 2099), "12-р сарын 30 · 2100 оны 1-р сарын 6");
});
