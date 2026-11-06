import assert from "node:assert/strict";
import test from "node:test";

import {
  declaredHotelProfiles,
  formatHotelName,
  hotelLinksFromMetadata,
  hotelLinkTargets,
  hotelNameMatchScore,
  hotelProfilesFromData,
  hotelTextSegments,
  matchHotelProfile,
  splitHotelNames,
  stayHotels,
} from "../src/lib/hotelLinks.ts";

test("hotel links accept only named HTTPS destinations", () => {
  assert.deepEqual(hotelLinksFromMetadata({ hotel_links: [
    { name: "Norvel Grand Hotel Example Bay", url: "https://hotels.example.com/norvel-grand/" },
    { name: "Unsafe", url: "javascript:alert(1)" },
    { name: "Norvel Grand Hotel Example Bay", url: "https://duplicate.example/" },
  ] }), [{ name: "Norvel Grand Hotel Example Bay", url: "https://hotels.example.com/norvel-grand/" }]);
});

test("hotel text keeps alternatives readable while linking every known hotel", () => {
  const links = [
    { name: "Norvel Grand Hotel Example Bay", url: "https://norvel-grand.example/" },
    { name: "Tavrin Beach", url: "https://tavrin-beach.example/" },
  ];
  assert.deepEqual(
    hotelTextSegments("Norvel Grand Hotel Example Bay эсвэл Tavrin Beach", links),
    [
      { text: "Norvel Grand Hotel Example Bay", url: "https://norvel-grand.example/" },
      { text: " эсвэл " },
      { text: "Tavrin Beach", url: "https://tavrin-beach.example/" },
    ],
  );
});

test("unknown accommodation remains plain text", () => {
  assert.deepEqual(hotelTextSegments("Хөтөлбөрийн дагуух зочид буудал", []), [
    { text: "Хөтөлбөрийн дагуух зочид буудал" },
  ]);
});

test("hotel profiles keep each hotel's own media and description", () => {
  const profiles = hotelProfilesFromData({ hotel_profiles: [
    { name: "Hotel One", url: "https://one.example/", description: "Beach", media: [{ url: "https://res.cloudinary.com/demo/image/upload/one.webp", caption: "Pool" }] },
    { name: "Hotel Two", url: "https://two.example/", description: "City", media: [] },
  ] }, "ignored", []);

  assert.equal(profiles.length, 2);
  assert.equal(profiles[0].media[0].caption, "Pool");
  assert.equal(profiles[1].description, "City");
});

test("legacy hotel data remains visible in the first inferred hotel", () => {
  const profiles = hotelProfilesFromData({ hotel_links: [
    { name: "Hotel One", url: "https://one.example/" },
    { name: "Hotel Two", url: "https://two.example/" },
  ] }, "Hotel One, Hotel Two", [{ url: "https://res.cloudinary.com/demo/image/upload/one.webp", caption: "" }]);

  assert.equal(profiles.length, 2);
  assert.equal(profiles[0].media.length, 1);
  assert.equal(profiles[1].media.length, 0);
});

// ---- Hotel cards from the hotels a trip is sold with (invented names only) ----
const PROFILES = { hotel_profiles: [
  { name: "Sarnai Island Resort Norvel", url: "https://sarnai.example/", description: "Далайн эрэг", media: [{ url: "https://res.cloudinary.com/demo/image/upload/sarnai.webp", caption: "Усан сан" }] },
  { name: "Grand Altara Bay Hotel Norvel", url: "", description: "Хотын төв", media: [] },
  { name: "Velt Crown", url: "https://velt.example/", description: "", media: [] },
] };

test("hotel names match however they are spaced, and by their own words", () => {
  assert.equal(hotelNameMatchScore("Veltcrown", "Velt Crown"), 3);
  assert.equal(hotelNameMatchScore("Sarnai", "Sarnai Island Resort Norvel"), 2);
  assert.equal(hotelNameMatchScore("Hotel", "Grand Altara Bay Hotel Norvel"), 0, "a generic word alone is no match");
  assert.equal(hotelNameMatchScore("Sarnai", "Velt Crown"), 0);
});

test("a partial name fitting two hotels is no match rather than a guess", () => {
  const profiles = declaredHotelProfiles(PROFILES, []);
  assert.equal(matchHotelProfile("Norvel", profiles), null);
  assert.equal(matchHotelProfile("Sarnai", profiles)?.name, "Sarnai Island Resort Norvel");
  assert.equal(matchHotelProfile("Veltcrown", profiles)?.name, "Velt Crown");
});

test("combined stays split into hotels; a comma is part of a name", () => {
  assert.deepEqual(splitHotelNames("Veltcrown+Sarnai"), ["Veltcrown", "Sarnai"]);
  assert.deepEqual(splitHotelNames("Velt Crown эсвэл Sarnai / Altara"), ["Velt Crown", "Sarnai", "Altara"]);
  assert.deepEqual(splitHotelNames("Altara Bay, Old Town"), ["Altara Bay, Old Town"]);
  assert.equal(formatHotelName("Veltcrown+Sarnai"), "Veltcrown + Sarnai");
});

test("hotel cards show only the hotels the trip is sold with, matched to their profiles", () => {
  const cards = stayHotels(PROFILES, "ignored", [], ["Veltcrown+Sarnai", "Sarnai", "Mystery Lodge"]);
  assert.deepEqual(cards.map((card) => card.name), ["Velt Crown", "Sarnai Island Resort Norvel", "Mystery Lodge"]);
  assert.deepEqual(cards[1].soldIn, ["Veltcrown + Sarnai", "Sarnai"]);
  assert.equal(cards[1].url, "https://sarnai.example/");
  assert.equal(cards[1].media[0].caption, "Усан сан");
  assert.equal(cards[2].url, "", "a priced hotel with no profile is a name-only card");
  assert.ok(!cards.some((card) => card.name.startsWith("Grand Altara")), "a profile no price row sells is left out");
});

test("a trip priced without hotels keeps every declared profile", () => {
  const cards = stayHotels(PROFILES, null, [], []);
  assert.equal(cards.length, 3);
  assert.ok(cards.every((card) => card.soldIn.length === 0));
  assert.deepEqual(stayHotels({}, "Altara Bay", [], []).map((card) => card.name), ["Altara Bay"]);
});

test("short names used in days and price rows link to the hotel's page", () => {
  const profiles = declaredHotelProfiles(PROFILES, []);
  const targets = hotelLinkTargets(profiles, ["Veltcrown+Sarnai", "Sarnai", null, "Sarnai, Velt Crown"]);
  assert.deepEqual(targets.find((target) => target.name === "Sarnai"), { name: "Sarnai", url: "https://sarnai.example/" });
  assert.deepEqual(targets.find((target) => target.name === "Veltcrown"), { name: "Veltcrown", url: "https://velt.example/" });
  assert.ok(!targets.some((target) => target.name === "Sarnai, Velt Crown"), "text naming two hotels never links whole");
  assert.ok(!targets.some((target) => target.name.startsWith("Grand Altara")), "a profile without a link adds no target");
  assert.deepEqual(hotelTextSegments("Veltcrown + Sarnai", targets).filter((segment) => segment.url).map((segment) => segment.text), ["Veltcrown", "Sarnai"]);
});

test("'&' and an unspaced '/' are part of a hotel's name; 'or a similar hotel' is no hotel", () => {
  assert.deepEqual(splitHotelNames("Altara Bay Resort & Spa"), ["Altara Bay Resort & Spa"]);
  assert.deepEqual(splitHotelNames("Norvel Hotel & Resort"), ["Norvel Hotel & Resort"]);
  assert.deepEqual(splitHotelNames("Norvel/Tavrin Suites"), ["Norvel/Tavrin Suites"]);
  assert.deepEqual(splitHotelNames("Velt Crown эсвэл түүнтэй адил зэрэглэлийн буудал"), ["Velt Crown"]);
  assert.deepEqual(splitHotelNames("Velt Crown or similar"), ["Velt Crown"]);
  // Nothing but "a similar hotel": kept as written rather than left with no name.
  assert.deepEqual(splitHotelNames("Адил зэрэглэлийн буудал"), ["Адил зэрэглэлийн буудал"]);

  const resort = { hotel_profiles: [{ name: "Altara Bay Resort & Spa", url: "https://altara.example/", description: "", media: [] }] };
  const cards = stayHotels(resort, null, [], ["Altara Bay Resort & Spa"]);
  assert.deepEqual(cards.map((card) => [card.name, card.url]), [["Altara Bay Resort & Spa", "https://altara.example/"]]);
  const similar = stayHotels(PROFILES, null, [], ["Velt Crown эсвэл түүнтэй адил зэрэглэлийн буудал"]);
  assert.deepEqual(similar.map((card) => card.name), ["Velt Crown"]);
});

test("a fixed stop-over hotel no price row names keeps its card when a day names it", () => {
  const metadata = { hotel_profiles: [
    { name: "Tavrin Transit Inn", url: "", description: "Шилжих шөнө", media: [{ url: "https://res.cloudinary.com/demo/image/upload/tavrin.webp", caption: "Өрөө" }] },
    { name: "Velt Crown", url: "https://velt.example/", description: "", media: [] },
    { name: "Sarnai Island Resort Norvel", url: "", description: "", media: [] },
    { name: "Grand Altara Bay Hotel Norvel", url: "", description: "", media: [] },
  ] };
  const days = ["Tavrin Transit Inn-д хоноглоно", "Velt Crown", null];
  const cards = stayHotels(metadata, null, [], ["Velt Crown", "Sarnai"], days);
  assert.deepEqual(cards.map((card) => card.name), ["Velt Crown", "Sarnai Island Resort Norvel", "Tavrin Transit Inn"]);
  assert.equal(cards[2].media.length, 1);
  assert.deepEqual(cards[2].soldIn, []);
  assert.ok(!cards.some((card) => card.name.startsWith("Grand Altara")), "named nowhere while others are linked: not sold");
});

test("profile ids on the price rows link a hotel the name cannot", async () => {
  const { pricedHotelOptions } = await import("../src/lib/tripPriceOptions.ts");
  const metadata = {
    hotel_profiles: [
      { id: "p-norvel", name: "Норвел Айланд Резорт", url: "https://norvel.example/", description: "Далайн эрэг", media: [] },
      { name: "Сарнай Бэй", url: "https://sarnai-bay.example/", description: "", media: [] },
    ],
    price_groups: [
      { hotel: "Norvel", hotel_profile_ids: ["p-norvel"], dates: ["2099-03-04"], adult_price: 1111111 },
      // An id that is the key of the profile's name, as the chatbot writes for a profile without an id.
      { hotel: "Norvel+Sarnai", hotel_profile_ids: ["p-norvel", "сарнайбэй"], dates: ["2099-03-04"], adult_price: 1222222 },
    ],
  };
  const cards = stayHotels(metadata, null, [], pricedHotelOptions({ sourceMetadata: metadata }));
  assert.deepEqual(cards.map((card) => [card.name, card.url, card.soldIn]), [
    ["Норвел Айланд Резорт", "https://norvel.example/", ["Norvel", "Norvel + Sarnai"]],
    ["Сарнай Бэй", "https://sarnai-bay.example/", ["Norvel + Sarnai"]],
  ]);
});

test("with no id and no name match, the declared profiles still show beside the priced names", () => {
  const metadata = { hotel_profiles: [{ name: "Норвел Айланд Резорт", url: "https://norvel.example/", description: "Далайн эрэг", media: [] }] };
  const cards = stayHotels(metadata, null, [], ["Norvel"]);
  assert.deepEqual(cards.map((card) => [card.name, card.url]), [["Norvel", ""], ["Норвел Айланд Резорт", "https://norvel.example/"]]);
});

test("two cities' hotels joined by a comma become their four hotels, never a bogus combined card", () => {
  const metadata = { hotel_profiles: [
    { name: "Altara Bay Hotel", url: "https://altara.example/", description: "", media: [] },
    { name: "Norvel Beach", url: "", description: "", media: [] },
    { name: "Sarnai Kelda Center", url: "https://sarnai-kelda.example/", description: "", media: [] },
    { name: "Tavrin Morrow Hotel", url: "", description: "", media: [] },
  ] };
  const option = "Altara Bay Hotel эсвэл Norvel Beach, Sarnai Kelda Center эсвэл Tavrin Morrow Hotel";
  const cards = stayHotels(metadata, null, [], [option], ["Norvel Beach", "Sarnai Kelda Center"]);
  assert.deepEqual(cards.map((card) => [card.name, card.soldIn]), [
    ["Altara Bay Hotel", [option]],
    ["Norvel Beach", [option]],
    ["Sarnai Kelda Center", [option]],
    ["Tavrin Morrow Hotel", [option]],
  ]);
  assert.equal(cards[2].url, "https://sarnai-kelda.example/");
  // The separator rule itself is unchanged: a comma alone never splits a stay.
  assert.deepEqual(splitHotelNames(option), ["Altara Bay Hotel", "Norvel Beach, Sarnai Kelda Center", "Tavrin Morrow Hotel"]);
  // The first city's hotel written short ("Norvel Beach" for "Norvel Beach Lagoon"): the joined
  // part partly fits "Sarnai Kelda Center" alone, and must still not lose the Norvel hotel.
  const shortened = { hotel_profiles: metadata.hotel_profiles.map((profile) => (profile.name === "Norvel Beach" ? { ...profile, name: "Norvel Beach Lagoon" } : profile)) };
  assert.deepEqual(stayHotels(shortened, null, [], [option]).map((card) => [card.name, card.soldIn]), [
    ["Altara Bay Hotel", [option]],
    ["Norvel Beach Lagoon", [option]],
    ["Sarnai Kelda Center", [option]],
    ["Tavrin Morrow Hotel", [option]],
  ]);
});

test("a comma splits a part only when every piece is a different declared hotel", () => {
  const metadata = { hotel_profiles: [
    { name: "Norvel Beach", url: "", description: "", media: [] },
    { name: "Sarnai Kelda Center", url: "", description: "", media: [] },
  ] };
  // A comma inside one hotel's name: the name stays whole, matched to its one profile.
  assert.deepEqual(stayHotels(metadata, null, [], ["Norvel Beach, Old Town"]).map((card) => [card.name, card.soldIn]), [
    ["Norvel Beach", ["Norvel Beach, Old Town"]],
  ]);
  // No profiles at all: the comma name is one name-only card, as written.
  assert.deepEqual(stayHotels({}, null, [], ["Altara Bay, Old Town"]).map((card) => card.name), ["Altara Bay, Old Town"]);
  // Two declared hotels' full names without a separator: those hotels, no combined card.
  assert.deepEqual(stayHotels(metadata, null, [], ["Norvel Beach - Sarnai Kelda Center"]).map((card) => [card.name, card.soldIn]), [
    ["Norvel Beach", ["Norvel Beach - Sarnai Kelda Center"]],
    ["Sarnai Kelda Center", ["Norvel Beach - Sarnai Kelda Center"]],
  ]);
});

test("a short name two profiles could be is never given one of their cards", () => {
  const metadata = { hotel_profiles: ["Norvel Resort", "Norvel Lagoon Villas", "Sarnai Kelda Center"].map((name) => ({ name, url: "", description: "", media: [] })) };
  // "Norvel Lagoon" could be either Norvel: a name-only card, not "Norvel Resort"'s photos and text.
  const cards = stayHotels(metadata, null, [], ["Norvel Lagoon", "Sarnai Kelda Center"]);
  assert.deepEqual(cards.map((card) => [card.name, card.soldIn]), [
    ["Norvel Lagoon", ["Norvel Lagoon"]],
    ["Sarnai Kelda Center", ["Sarnai Kelda Center"]],
  ]);
  assert.equal(cards[0].description, "");
  // Only two hotels' FULL names, and nothing else, make a part those hotels.
  const leftover = "Norvel Resort Lagoon - Sarnai Kelda Center";
  const one = stayHotels(metadata, null, [], [leftover]);
  assert.deepEqual(one.filter((card) => card.soldIn.length).map((card) => [card.name, card.soldIn]), [[leftover, [leftover]]],
    "a hotel word left over: the part stays as written, sold in no profile's card");
  assert.deepEqual(stayHotels(metadata, null, [], ["Norvel Lagoon Villas - Sarnai Kelda Center"]).map((card) => [card.name, card.soldIn]), [
    ["Norvel Lagoon Villas", ["Norvel Lagoon Villas - Sarnai Kelda Center"]],
    ["Sarnai Kelda Center", ["Norvel Lagoon Villas - Sarnai Kelda Center"]],
  ]);
  // The same option linked by the chatbot's ids still follows the ids.
  const linked = { hotel_profiles: metadata.hotel_profiles.map((profile, index) => ({ ...profile, id: `h${index}` })) };
  assert.deepEqual(stayHotels(linked, null, [], [{ label: "Norvel Lagoon", profileIds: ["h1"] }]).map((card) => [card.name, card.soldIn]), [
    ["Norvel Lagoon Villas", ["Norvel Lagoon"]],
  ]);
});

test("older trip-level hotel photos never vanish when the price rows name the hotels", async () => {
  const { stayHotelSection } = await import("../src/lib/hotelLinks.ts");
  const photos = [
    { url: "https://res.cloudinary.com/demo/image/upload/a.webp", caption: "" },
    { url: "https://res.cloudinary.com/demo/image/upload/b.webp", caption: "" },
  ];
  const one = stayHotelSection({}, "Altara Bay", photos, ["Altara Bay"]);
  assert.deepEqual(one.hotels.map((card) => [card.name, card.media.length]), [["Altara Bay", 2]]);
  assert.deepEqual(one.sharedMedia, []);

  const named = stayHotelSection({}, "Altara Bay", photos, ["Altara Bay", "Norvel Garden"]);
  assert.deepEqual(named.hotels.map((card) => [card.name, card.media.length]), [["Altara Bay", 2], ["Norvel Garden", 0]]);

  // The trip's hotel text names both: the photos are shown once, under the cards, on no one hotel.
  const shared = stayHotelSection({}, "Altara Bay, Norvel Garden", photos, ["Altara Bay", "Norvel Garden"]);
  assert.deepEqual(shared.hotels.map((card) => card.media.length), [0, 0]);
  assert.equal(shared.sharedMedia.length, 2);

  // A profile list of its own carries the photos; the trip-level copy is not repeated.
  const profiled = stayHotelSection(PROFILES, null, photos, ["Sarnai"]);
  assert.deepEqual(profiled.sharedMedia, []);
});
