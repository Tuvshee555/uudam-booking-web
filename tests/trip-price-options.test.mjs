import assert from "node:assert/strict";
import test from "node:test";

import {
  datePriceOptions,
  formatAdultOption,
  formatPassengerOption,
  formatPriceDelta,
  hasVariablePricing,
  priceDimensionOptions,
  pricedHotelLabels,
  splitPackedHotel,
} from "../src/lib/tripPriceOptions.ts";

// Invented hotels, packages and prices only — never a catalogue trip.
const PACKAGES = [
  { id: "Хөтөлбөргүй", label: "Хөтөлбөргүй", note: "" },
  { id: "Хөтөлбөртэй", label: "Хөтөлбөртэй", note: "Норвел хотын үзвэрүүдтэй" },
];
const packedTrip = (rows) => ({ sourceMetadata: { package_options: PACKAGES, price_groups: rows } });
const packedRow = (hotel, price, extra = {}) => ({ hotel, label: "2099-03-04", dates: ["2099-03-04"], date_keys: ["2099-03-04"], adult_price: price, ...extra });

test("partner hotel availability and date-specific supplements reach the picker", () => {
  const trip = { sourceMetadata: { price_groups: [
    { hotel: "Example Bay", dates: ["2099-06-12"], adult_price: 2100000, single_price: 520000, availability: { status: "sold_out" } },
    { hotel: "Example Garden", package_id: "Хөтөлбөргүй", dates: ["2099-06-12"], adult_price: 2600000, single_price: 620000, availability: { status: "open", seatsLeft: 12 } },
    { hotel: "Example Grove", dates: ["2099-06-12"], adult_price: 2300000, availability: { status: "open", seatsLeft: 0 } },
    { hotel: "Example Garden", dates: ["2099-06-19"], adult_price: 2700000, single_price: 720000, availability: { status: "open" } },
  ] } };
  const options = datePriceOptions(trip, { startDate: "2099-06-12T00:00:00.000Z" });
  assert.equal(options.length, 1);
  assert.equal(options[0].hotel, "Example Garden");
  assert.equal(options[0].singleSupplement, 620000);
  // No package_options note: nothing is invented to describe the package.
  assert.equal(options[0].packageNote, "");
  assert.equal(datePriceOptions(trip, { startDate: "2099-06-19T00:00:00.000Z" })[0].singleSupplement, 720000);
});

test("hotel fares match only their departure and preserve age tiers", () => {
  const trip = { sourceMetadata: { price_groups: [
    { hotel: "Sarnai", date_keys: ["2026-10-01"], adult_price: 3290000,
      passenger_prices: [{ label: "Хүүхэд 6-11 нас", age_range: "6-11 нас", price: 3090000 }] },
    { hotel: "Altara", date_keys: ["2026-10-01"], adult_price: 2790000,
      passenger_prices: [{ label: "Хүүхэд 2-5 нас", age_range: "2-5 нас", price: 2390000 }] },
  ] } };
  const options = datePriceOptions(trip, { startDate: "2026-10-01T00:00:00.000Z" });
  assert.equal(options.length, 2);
  assert.equal(options[0].hotel, "Sarnai");
  assert.equal(options[1].passengers[0].price, 2390000);
  assert.deepEqual(datePriceOptions(trip, { startDate: "2026-10-08T00:00:00.000Z" }), []);
  assert.equal(hasVariablePricing(trip), true);
  assert.equal(datePriceOptions(trip, { startDate: "2026-09-30T16:00:00.000Z" }).length, 2);
});

test("a single ordinary price group keeps the standard booking flow", () => {
  assert.equal(hasVariablePricing({ sourceMetadata: { price_groups: [{ adult_price: 2000000 }] } }), false);
});

test("package and hotel selectors remain independent and show price deltas", () => {
  const trip = { sourceMetadata: { price_groups: [
    { hotel: "Altara", package_id: "Хөтөлбөргүй", date_keys: ["2027-02-24"], adult_price: 2990000 },
    { hotel: "Altara", package_id: "Хөтөлбөртэй", date_keys: ["2027-02-24"], adult_price: 3290000 },
    { hotel: "Sarnai", package_id: "Хөтөлбөргүй", date_keys: ["2027-02-24"], adult_price: 3740000 },
    { hotel: "Sarnai", package_id: "Хөтөлбөртэй", date_keys: ["2027-02-24"], adult_price: 4040000 },
  ] } };
  const options = datePriceOptions(trip, { startDate: "2027-02-24T00:00:00.000Z" });
  const selected = options[0];
  const packages = priceDimensionOptions(options, "package", selected);
  const hotels = priceDimensionOptions(options, "hotel", selected);

  assert.deepEqual(packages.map((option) => option.label), ["Хөтөлбөртэй", "Хөтөлбөргүй"]);
  assert.equal(formatPriceDelta(packages[0]), "+300,000₮");
  assert.equal(formatPriceDelta(packages[1]), "Хамгийн хямд");
  assert.deepEqual(hotels.map((option) => option.label), ["Altara", "Sarnai"]);
  assert.equal(formatPriceDelta(hotels[1]), "+750,000₮");
  assert.equal(options.find((option) => option.key === packages[0].optionKey)?.hotel, "Altara");
  assert.equal(options.find((option) => option.key === hotels[1].optionKey)?.packageId, "Хөтөлбөргүй");
});

test("a packed 'Hotel · Package' row splits into its hotel and package choices", () => {
  const trip = packedTrip([
    packedRow("Норвел Бэй+Сарнай Резорт · Хөтөлбөргүй", 1111111),
    packedRow("Норвел Бэй+Сарнай Резорт · Хөтөлбөртэй", 1222222),
    packedRow("Сарнай Резорт · Хөтөлбөргүй", 1333333),
    packedRow("Сарнай Резорт · Хөтөлбөртэй", 1444444),
  ]);
  const options = datePriceOptions(trip, { startDate: "2099-03-04T00:00:00.000Z" });
  assert.deepEqual(options.map((option) => [option.hotel, option.packageId]), [
    ["Норвел Бэй+Сарнай Резорт", "Хөтөлбөргүй"],
    ["Норвел Бэй+Сарнай Резорт", "Хөтөлбөртэй"],
    ["Сарнай Резорт", "Хөтөлбөргүй"],
    ["Сарнай Резорт", "Хөтөлбөртэй"],
  ]);
  assert.equal(new Set(options.map((option) => option.key)).size, 4);
  assert.equal(options[1].packageNote, "Норвел хотын үзвэрүүдтэй");
  assert.equal(options[0].packageNote, "", "an empty package note stays empty");

  const cheapest = options[0];
  const packages = priceDimensionOptions(options, "package", cheapest);
  const hotels = priceDimensionOptions(options, "hotel", cheapest);
  assert.deepEqual(packages.map((option) => option.label), ["Хөтөлбөртэй", "Хөтөлбөргүй"]);
  assert.deepEqual(hotels.map((option) => [option.label, option.adult]), [["Норвел Бэй+Сарнай Резорт", 1111111], ["Сарнай Резорт", 1333333]]);
  assert.deepEqual(pricedHotelLabels(trip), ["Норвел Бэй+Сарнай Резорт", "Сарнай Резорт"]);
});

test("the ' · ' split happens only when the right side is one of the trip's packages", () => {
  assert.deepEqual(splitPackedHotel("Altara · Garden Wing", "", PACKAGES), { hotel: "Altara · Garden Wing", packageId: "" });
  assert.deepEqual(splitPackedHotel("Altara · хөтөлбөртэй", "", PACKAGES), { hotel: "Altara", packageId: "Хөтөлбөртэй" });
  assert.deepEqual(splitPackedHotel("Altara · Хөтөлбөртэй", "", []), { hotel: "Altara · Хөтөлбөртэй", packageId: "" }, "no package options, nothing to split on");
  // A stored package_id that agrees with the suffix: the suffix comes off the hotel.
  assert.deepEqual(splitPackedHotel("Altara · Хөтөлбөртэй", "Хөтөлбөртэй", PACKAGES), { hotel: "Altara", packageId: "Хөтөлбөртэй" });
  // A stored package_id that disagrees: the row is left exactly as stored.
  assert.deepEqual(splitPackedHotel("Altara · Хөтөлбөртэй", "Хөтөлбөргүй", PACKAGES), { hotel: "Altara · Хөтөлбөртэй", packageId: "Хөтөлбөргүй" });
});

test("rows that already carry package_id work unchanged, with the package's display label", () => {
  const trip = { sourceMetadata: {
    package_options: [{ id: "free", label: "Чөлөөт", note: "" }, { id: "guided", label: "Хөтөчтэй", note: "" }],
    price_groups: [
      packedRow("Altara", 1111111, { package_id: "free" }),
      packedRow("Altara", 1555555, { package_id: "guided" }),
    ],
  } };
  const options = datePriceOptions(trip, { startDate: "2099-03-04T00:00:00.000Z" });
  assert.deepEqual(options.map((option) => [option.hotel, option.packageId, option.packageLabel]), [["Altara", "free", "Чөлөөт"], ["Altara", "guided", "Хөтөчтэй"]]);
  assert.deepEqual(priceDimensionOptions(options, "package", options[0]).map((option) => option.label).sort(), ["Хөтөчтэй", "Чөлөөт"]);
});

test("a row's own label and note survive; a date stamped as the label does not count as a name", () => {
  const trip = { sourceMetadata: { price_groups: [
    packedRow("Altara", 1111111, { note: "2 хүүхэд хүртэл" }),
    { label: "Эрт захиалга", dates: ["2099-03-11"], adult_price: 1222222, note: "" },
    { label: "11/03", dates: ["2099-03-11"], display_dates: ["11/03"], adult_price: 1333333 },
  ] } };
  const [first] = datePriceOptions(trip, { startDate: "2099-03-04T00:00:00.000Z" });
  assert.equal(first.rowLabel, "");
  assert.equal(first.note, "2 хүүхэд хүртэл");
  const later = datePriceOptions(trip, { startDate: "2099-03-11T00:00:00.000Z" });
  assert.deepEqual(later.map((option) => option.rowLabel), ["Эрт захиалга", ""]);
});

test("sold-out variants are hidden from the picker but kept, flagged, for the price table", () => {
  const trip = { sourceMetadata: { price_groups: [
    packedRow("Altara", 1111111, { availability: { status: "sold_out" } }),
    packedRow("Норвел Бэй", 1222222, { availability: { status: "open", seatsLeft: 4 } }),
  ] } };
  const departure = { startDate: "2099-03-04T00:00:00.000Z" };
  assert.deepEqual(datePriceOptions(trip, departure).map((option) => option.hotel), ["Норвел Бэй"]);
  const all = datePriceOptions(trip, departure, { includeUnavailable: true });
  assert.deepEqual(all.map((option) => [option.hotel, option.available]), [["Altara", false], ["Норвел Бэй", true]]);
});

test("a yuan-priced row is never quoted as a selling price", () => {
  const trip = { sourceMetadata: { price_groups: [
    packedRow("Altara", 3333, { currency: "CNY", single_price: 444, passenger_prices: [{ label: "Хүүхэд", age_range: "2-5 нас", price: 2222 }] }),
    packedRow("Норвел Бэй", 1111111, { currency: "MNT", passenger_prices: [{ label: "Хүүхэд", age_range: "2-5 нас", price: 999999, currency: "CNY" }] }),
  ] } };
  const [yuan, tugrug] = datePriceOptions(trip, { startDate: "2099-03-04T00:00:00.000Z" });
  assert.equal(yuan.adult, null);
  assert.equal(yuan.singleSupplement, null);
  assert.equal(yuan.passengers[0].price, null);
  assert.equal(tugrug.adult, 1111111);
  assert.equal(tugrug.passengers[0].price, null, "a yuan band inside a tugrug row is dropped too");
});

test("child bands keep a range or a free fare as the source gives it", () => {
  const trip = { sourceMetadata: { price_groups: [packedRow("Altara", 1111111, { passenger_prices: [
    { label: "Хүүхэд", age_range: "6-11 нас", price: null, price_range: { min: 700000, max: 900000 } },
    { label: "Нярай", age_range: "0-2 нас", price: 0, note: "Үнэгүй" },
  ] })] } };
  const [option] = datePriceOptions(trip, { startDate: "2099-03-04T00:00:00.000Z" });
  assert.equal(formatPassengerOption(option.passengers[0]), "700,000₮–900,000₮");
  assert.equal(formatPassengerOption(option.passengers[1]), "Үнэгүй");
  assert.equal(formatPassengerOption({ price: null, priceMax: null }), "Үнэ лавлах");
});

test("a poster-style date text is never a row name, even when the row's dates are ISO", async () => {
  const { isDateLabel } = await import("../src/lib/tripPriceOptions.ts");
  // The row shape the chatbot's website payload writes: the source label kept, the dates reset to one ISO day.
  const stamped = (label) => ({ label, dates: ["2099-11-18"], display_dates: ["2099-11-18"], date_keys: ["2099-11-18"], adult_price: 1111111 });
  const trip = { sourceMetadata: { price_groups: [
    stamped("11 сарын 11, 18, 25"),
    stamped("11/11, 11/18"),
    stamped("2099 оны 11 сарын 11, 2099 оны 11 сарын 18"),
  ] } };
  const options = datePriceOptions(trip, { startDate: "2099-11-18T00:00:00.000Z" });
  assert.deepEqual(options.map((option) => option.rowLabel), ["", "", ""]);
  for (const label of ["11-р сарын 11-ээс 25 хүртэл", "2099-11-11, 2099-11-18", "11.18-ны", "Nov 11, 18"]) {
    assert.equal(isDateLabel(label), true, label);
  }
  // A real name keeps its words, even with a number in it.
  for (const label of ["Эрт захиалга", "2 хүүхэд хүртэл", "1-р ээлж", "Стандарт өрөө", "Норвел 3 од"]) {
    assert.equal(isDateLabel(label), false, label);
  }
});

test("a 0₮ or sub-1,000₮ figure is an unpublished fare, never a price or 'free'", () => {
  const trip = { sourceMetadata: { price_groups: [
    packedRow("Altara", 0, { single_price: 0, child_price: 0, infant_price: 1, passenger_prices: [] }),
    packedRow("Норвел Бэй", 1, { passenger_prices: [
      { label: "Хүүхэд", age_range: "2-5 нас", price: 0 },
      { label: "Нярай", age_range: "0-2 нас", price: 999 },
    ] }),
  ] } };
  const [zero, one] = datePriceOptions(trip, { startDate: "2099-03-04T00:00:00.000Z" });
  assert.equal(zero.adult, null);
  assert.equal(formatAdultOption(zero), "Үнэ лавлах");
  assert.equal(zero.singleSupplement, null);
  // The row names a child and an infant figure: the bands stay, reading "ask", never "free".
  assert.deepEqual(zero.passengers.map((band) => [band.label, formatPassengerOption(band)]), [["Хүүхэд", "Үнэ лавлах"], ["Нярай", "Үнэ лавлах"]]);
  assert.equal(one.adult, null);
  assert.deepEqual(one.passengers.map((band) => formatPassengerOption(band)), ["Үнэ лавлах", "Үнэ лавлах"]);
  assert.equal(formatAdultOption({ adult: 1, adultMax: null }), "Үнэ лавлах", "a caller's own placeholder is not printed either");
  assert.equal(formatPassengerOption({ price: 0, priceMax: null }), "Үнэ лавлах", "0 without a free mark is not free");
});

test("a row's own child or infant 0 is free only with the chatbot's free mark", () => {
  const trip = { sourceMetadata: { price_groups: [
    packedRow("Altara", 1111111, { child_price: 0, infant_price: 0, infant_price_free: true }),
    packedRow("Норвел Бэй", 1222222, { infant_price: 0, note: "Нярай үнэгүй" }),
  ] } };
  const [flagged, noted] = datePriceOptions(trip, { startDate: "2099-03-04T00:00:00.000Z" });
  assert.deepEqual(flagged.passengers.map((band) => [band.label, formatPassengerOption(band)]), [["Хүүхэд", "Үнэ лавлах"], ["Нярай", "Үнэгүй"]]);
  assert.equal(flagged.child, null);
  assert.equal(flagged.infant, 0);
  assert.deepEqual(noted.passengers.map((band) => formatPassengerOption(band)), ["Үнэгүй"]);
});

test("an adult fare sent only as a range quotes the range", () => {
  const trip = { sourceMetadata: { price_groups: [
    packedRow("Altara", null, { adult_price_range: { min: 1111111, max: 1555555 } }),
    packedRow("Норвел Бэй", 1222222, { adult_price_range: { min: 1222222, max: 1222222 } }),
  ] } };
  const [range, flat] = datePriceOptions(trip, { startDate: "2099-03-04T00:00:00.000Z" });
  assert.deepEqual([range.adult, range.adultMax], [1111111, 1555555]);
  assert.equal(formatAdultOption(range), "1,111,111₮–1,555,555₮");
  assert.equal(flat.adultMax, null, "a range of one figure is one fare");
});

test("the booking estimate spans a ranged child band instead of quoting its low end", async () => {
  const { quoteRange } = await import("../src/lib/tripPriceOptions.ts");
  const trip = { sourceMetadata: { price_groups: [packedRow("Altara", 3111111, { passenger_prices: [
    { label: "Хүүхэд", age_range: "2-11 нас", price: null, price_range: { min: 1111111, max: 1555555 } },
    { label: "Нярай", age_range: "0-2 нас", price: 0, note: "Үнэгүй" },
  ] })] } };
  const [option] = datePriceOptions(trip, { startDate: "2099-03-04T00:00:00.000Z" });
  const [child, infant] = option.passengers;
  assert.equal(formatPassengerOption(child), "1,111,111₮–1,555,555₮");
  const tiers = (children, infants) => [
    { count: children, price: child.price, priceMax: child.priceMax },
    { count: infants, price: infant.price, priceMax: infant.priceMax },
  ];
  assert.deepEqual(quoteRange(1, { low: option.adult, high: option.adultMax }, tiers(1, 1)), { min: 4222222, max: 4666666 });
  assert.deepEqual(quoteRange(2, { low: 1111111, high: 1333333 }, tiers(0, 0)), { min: 2222222, max: 2666666 });
  assert.equal(quoteRange(1, { low: 3111111, high: null }, [{ count: 1, price: null, priceMax: null }]), null, "a counted band with no fare");
  assert.equal(quoteRange(1, { low: 0, high: null }, []), null, "no real adult fare");
  assert.deepEqual(quoteRange(1, { low: 3111111, high: null }, [{ count: 0, price: null, priceMax: null }]), { min: 3111111, max: 3111111 }, "an uncounted band does not block the estimate");
});

test("priced hotel options carry the chatbot's profile ids", async () => {
  const { pricedHotelOptions } = await import("../src/lib/tripPriceOptions.ts");
  const trip = packedTrip([
    packedRow("Норвел Бэй+Сарнай Резорт · Хөтөлбөргүй", 1111111, { hotel_profile_ids: ["norvel", "sarnai"] }),
    packedRow("Норвел Бэй+Сарнай Резорт · Хөтөлбөртэй", 1222222),
    packedRow("Сарнай Резорт", 1333333, { hotel_id: "sarnai" }),
    packedRow("Altara", 1444444),
  ]);
  assert.deepEqual(pricedHotelOptions(trip), [
    { label: "Норвел Бэй+Сарнай Резорт", profileIds: ["norvel", "sarnai"] },
    { label: "Сарнай Резорт", profileIds: ["sarnai"] },
    { label: "Altara", profileIds: [] },
  ]);
  assert.deepEqual(pricedHotelLabels(trip), ["Норвел Бэй+Сарнай Резорт", "Сарнай Резорт", "Altara"]);
});

test("two rows with the same hotel, package and label still get distinct keys", () => {
  const trip = { sourceMetadata: { price_groups: [packedRow("Altara", 1111111), packedRow("Altara", 1222222)] } };
  const keys = datePriceOptions(trip, { startDate: "2099-03-04T00:00:00.000Z" }).map((option) => option.key);
  assert.equal(new Set(keys).size, 2);
});

test("bands that differ only by a height condition are two bands, each naming its condition", () => {
  const trip = { sourceMetadata: { price_groups: [packedRow("Altara", 2111111, { passenger_prices: [
    // The chatbot's shape: the condition in the label and in its own field.
    { label: "Хүүхэд (1,2–1,4 м өндөр)", age_range: "", condition: "1,2–1,4 м өндөр", price: 1111111 },
    // A label that leaves the condition out gets it in the visible label.
    { label: "Хүүхэд", age_range: "", condition: "1,4 м-ээс дээш", price: 1333333 },
    // Written with a dot and a plain dash: still the condition the label says, not repeated.
    { label: "Хүүхэд 1.0-1.2 м өндөр", age_range: "", condition: "1,0–1,2 м өндөр", price: 999999 },
  ] })] } };
  const [option] = datePriceOptions(trip, { startDate: "2099-03-04T00:00:00.000Z" });
  assert.deepEqual(option.passengers.map((band) => [band.label, band.condition, band.price]), [
    ["Хүүхэд (1,2–1,4 м өндөр)", "1,2–1,4 м өндөр", 1111111],
    ["Хүүхэд (1,4 м-ээс дээш)", "1,4 м-ээс дээш", 1333333],
    ["Хүүхэд 1.0-1.2 м өндөр", "1,0–1,2 м өндөр", 999999],
  ]);
  assert.equal(new Set(option.passengers.map((band) => band.key)).size, 3, "no two bands share a key");
});

test("a band repeated with another fare keeps its own key; a plain band has an empty condition", () => {
  const trip = { sourceMetadata: { price_groups: [packedRow("Altara", 2111111, { passenger_prices: [
    { label: "Хүүхэд", age_range: "2-4 нас", price: 1111111 },
    { label: "Хүүхэд", age_range: "2-4 нас", price: 1222222 },
    { label: "Хүүхэд", age_range: "2-4 нас", price: 1333333 },
  ] })] } };
  const [option] = datePriceOptions(trip, { startDate: "2099-03-04T00:00:00.000Z" });
  assert.deepEqual(option.passengers.map((band) => band.key), ["Хүүхэд 2-4 нас|2-4 нас|", "Хүүхэд 2-4 нас|2-4 нас|#2", "Хүүхэд 2-4 нас|2-4 нас|#3"]);
  assert.ok(option.passengers.every((band) => band.condition === ""));
});

test("a row that lists each band twice gives one counter per band, so the estimate is not doubled", async () => {
  const { quoteRange } = await import("../src/lib/tripPriceOptions.ts");
  const bands = [
    { label: "Хүүхэд 4-12 нас", age_range: "4-12 нас", price: 1222222 },
    { label: "Хүүхэд 2-4 нас", age_range: "2-4 нас", price: 1111111 },
    { label: "Нярай 0-2 нас", age_range: "0-2 нас", price: 333333 },
  ];
  const trip = { sourceMetadata: { price_groups: [packedRow("Altara", 2111111, { passenger_prices: [...bands, ...bands] })] } };
  const [option] = datePriceOptions(trip, { startDate: "2099-03-04T00:00:00.000Z" });
  assert.deepEqual(option.passengers.map((band) => band.label), ["Хүүхэд 4-12 нас", "Хүүхэд 2-4 нас", "Нярай 0-2 нас"]);
  assert.equal(new Set(option.passengers.map((band) => band.key)).size, 3);
  // One child of each kind counted, as the booking panel's counters would.
  const counts = { [option.passengers[0].key]: 1, [option.passengers[1].key]: 1 };
  const tiers = option.passengers.map((band) => ({ count: counts[band.key] ?? 0, price: band.price, priceMax: band.priceMax }));
  assert.deepEqual(quoteRange(1, { low: option.adult, high: option.adultMax }, tiers), { min: 4444444, max: 4444444 });
  const children = option.passengers.filter((band) => !/нярай|infant/i.test(band.label)).reduce((sum, band) => sum + (counts[band.key] ?? 0), 0);
  assert.equal(children, 2, "the enquiry's child count is the children counted, not twice that");
});

test("hotel and package choices carry a ranged row's high end, so the button prints the range", () => {
  const trip = { sourceMetadata: { price_groups: [
    packedRow("Altara", null, { package_id: "Хөтөлбөргүй", adult_price_range: { min: 1111111, max: 1555555 } }),
    packedRow("Норвел Бэй", 1222222, { package_id: "Хөтөлбөргүй" }),
    packedRow("Altara", 1666666, { package_id: "Хөтөлбөртэй" }),
  ] } };
  const options = datePriceOptions(trip, { startDate: "2099-03-04T00:00:00.000Z" });
  const ranged = options[0];
  const hotels = priceDimensionOptions(options, "hotel", ranged);
  assert.deepEqual(hotels.map((item) => [item.label, item.adult, item.adultMax, formatAdultOption(item)]), [
    ["Altara", 1111111, 1555555, "1,111,111₮–1,555,555₮"],
    ["Норвел Бэй", 1222222, null, "1,222,222₮"],
  ]);
  const packages = priceDimensionOptions(options, "package", ranged);
  assert.deepEqual(packages.map((item) => [item.label, formatAdultOption(item)]), [["Хөтөлбөртэй", "1,666,666₮"], ["Хөтөлбөргүй", "1,111,111₮–1,555,555₮"]]);
});
