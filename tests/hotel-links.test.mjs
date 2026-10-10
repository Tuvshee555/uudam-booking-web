import assert from "node:assert/strict";
import test from "node:test";

import { hotelLinksFromMetadata, hotelTextSegments } from "../src/lib/hotelLinks.ts";

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
