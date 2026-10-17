import assert from "node:assert/strict";
import test from "node:test";

import { tripGalleryImages } from "../src/lib/tripMedia.ts";

test("hero gallery includes itinerary photos in day order", () => {
  assert.deepEqual(tripGalleryImages({
    image: "cover.jpg",
    extraImages: ["extra.jpg"],
    itinerary: [
      { image: "day-1.jpg" },
      { image: "day-2.jpg" },
    ],
  }), ["cover.jpg", "extra.jpg", "day-1.jpg", "day-2.jpg"]);
});

test("hero gallery removes blanks and photos already used by cover or other days", () => {
  assert.deepEqual(tripGalleryImages({
    image: " cover.jpg ",
    extraImages: ["", "day-1.jpg"],
    itinerary: [
      { image: "cover.jpg" },
      { image: null },
      { image: "day-1.jpg" },
    ],
  }), ["cover.jpg", "day-1.jpg"]);
});
