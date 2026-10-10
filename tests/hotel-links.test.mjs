import assert from "node:assert/strict";
import test from "node:test";

import { hotelLinksFromMetadata, hotelProfilesFromData, hotelTextSegments } from "../src/lib/hotelLinks.ts";

test("hotel links accept only named HTTPS destinations", () => {
  assert.deepEqual(hotelLinksFromMetadata({ hotel_links: [
    { name: "Brighton Grand Hotel Pattaya", url: "https://pattaya.brightongroups.com/" },
    { name: "Unsafe", url: "javascript:alert(1)" },
    { name: "Brighton Grand Hotel Pattaya", url: "https://duplicate.example/" },
  ] }), [{ name: "Brighton Grand Hotel Pattaya", url: "https://pattaya.brightongroups.com/" }]);
});

test("hotel text keeps alternatives readable while linking every known hotel", () => {
  const links = [
    { name: "Brighton Grand Hotel Pattaya", url: "https://brighton.example/" },
    { name: "Long Beach", url: "https://long-beach.example/" },
  ];
  assert.deepEqual(
    hotelTextSegments("Brighton Grand Hotel Pattaya эсвэл Long Beach", links),
    [
      { text: "Brighton Grand Hotel Pattaya", url: "https://brighton.example/" },
      { text: " эсвэл " },
      { text: "Long Beach", url: "https://long-beach.example/" },
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
