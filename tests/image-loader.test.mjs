import assert from "node:assert/strict";
import test from "node:test";

import imageLoader from "../src/lib/imageLoader.ts";

test("Cloudinary photos are resized by Cloudinary, never upscaled", () => {
  const url = imageLoader({ src: "https://res.cloudinary.com/demo/image/upload/v1/folder/pic.jpg", width: 640, quality: 75 });
  assert.equal(url, "https://res.cloudinary.com/demo/image/upload/f_auto,q_75,w_640,c_limit/v1/folder/pic.jpg");
});

test("Cloudinary photos with an existing transformation keep it as a later step", () => {
  const url = imageLoader({ src: "https://res.cloudinary.com/demo/image/upload/c_fill,w_800/v1/pic.jpg", width: 384 });
  assert.equal(url, "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_384,c_limit/c_fill,w_800/v1/pic.jpg");
});

test("Unsplash photos get width and quality parameters", () => {
  const url = new URL(imageLoader({ src: "https://images.unsplash.com/photo-1?auto=format&fit=crop&w=2000", width: 828, quality: 85 }));
  assert.equal(url.searchParams.get("w"), "828");
  assert.equal(url.searchParams.get("q"), "85");
  assert.equal(url.searchParams.get("fit"), "crop");
});

test("local files and other hosts are returned untouched", () => {
  assert.equal(imageLoader({ src: "/uudam-logo.jpg", width: 96 }), "/uudam-logo.jpg");
  assert.equal(imageLoader({ src: "https://example.org/a.png", width: 96 }), "https://example.org/a.png");
});
