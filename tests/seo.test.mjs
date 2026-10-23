import assert from "node:assert/strict";
import test from "node:test";

import { canonicalPath, withoutRetiredLocale } from "../src/lib/locales.ts";
import { tripMetaDescription } from "../src/lib/tripSeo.ts";

const now = new Date("2099-03-01T05:00:00+08:00");
const trip = (over = {}) => ({
  summary: null,
  description: "",
  durationDays: 9,
  durationNights: 8,
  price: 1_234_000,
  destinations: [],
  departures: [],
  ...over,
});
const open = (iso) => ({ startDate: iso, status: "OPEN" });

test("a hand-written summary wins over anything generated", () => {
  const summary = "Энэ бол хэн нэгний бичсэн, хангалттай урт товч танилцуулга юм шүү.";
  assert.equal(tripMetaDescription(trip({ summary }), now), summary);
});

test("a one-word summary is too thin to use, so the facts are used instead", () => {
  const text = tripMetaDescription(trip({ summary: "Аялал" }), now);
  assert.match(text, /9 өдөр 8 шөнө/);
});

test("it states the length, the price and the next three open dates", () => {
  const text = tripMetaDescription(
    trip({ departures: [open("2099-03-12T00:00:00Z"), open("2099-03-05T00:00:00Z"), open("2099-03-19T00:00:00Z"), open("2099-04-02T00:00:00Z")] }),
    now,
  );
  assert.match(text, /9 өдөр 8 шөнө/);
  assert.match(text, /Үнэ 1,234,000₮-с эхлэн/);
  assert.match(text, /Ойрын гарах: 3\/5, 3\/12, 3\/19(?!,)/, "three earliest dates, in order, no fourth");
});

test("past, sold-out and cancelled departures are never advertised", () => {
  const text = tripMetaDescription(
    trip({ departures: [open("2099-02-20T00:00:00Z"), { startDate: "2099-03-10T00:00:00Z", status: "SOLD_OUT" }, { startDate: "2099-03-11T00:00:00Z", status: "CANCELLED" }, open("2099-03-15T00:00:00Z")] }),
    now,
  );
  assert.match(text, /Ойрын гарах: 3\/15(?!,)/);
  assert.doesNotMatch(text, /2\/20|3\/10|3\/11/);
});

test("dates are read in Ulaanbaatar time, not UTC", () => {
  // 20:00 UTC on the 4th is already the 5th in Ulaanbaatar (UTC+8).
  const text = tripMetaDescription(trip({ departures: [open("2099-03-04T20:00:00Z")] }), now);
  assert.match(text, /Ойрын гарах: 3\/5/);
});

test("an unpriced trip never says it starts from 0₮", () => {
  const text = tripMetaDescription(trip({ price: 0 }), now);
  assert.doesNotMatch(text, /Үнэ|0₮/);
  assert.match(text, /Хөтөлбөр, үнэ/);
});

test("an empty description still gives a useful preview", () => {
  const text = tripMetaDescription(trip({ description: "", destinations: ["Хот А", "Хот Б"] }), now);
  assert.match(text, /Хот А – Хот Б/);
  assert.ok(text.length > 40);
});

test("a description that is just the length line is not repeated", () => {
  const text = tripMetaDescription(trip({ description: "УБ-аас 8 шөнө 9 өдөр" }), now);
  assert.doesNotMatch(text, /УБ-аас/);
});

test("a long description is cut to fit the 160 characters a search result shows", () => {
  const text = tripMetaDescription(trip({ description: "Урт тайлбар ".repeat(80), departures: [open("2099-03-05T00:00:00Z")] }), now);
  assert.ok(text.length <= 160, `${text.length} chars`);
});

test("canonical URLs always carry the one live locale", () => {
  assert.equal(canonicalPath(""), "/mn");
  assert.equal(canonicalPath("/trips"), "/mn/trips");
  assert.equal(canonicalPath("trips/abc"), "/mn/trips/abc");
});

test("retired /en and /ko prefixes map to /mn, nothing else does", () => {
  assert.equal(withoutRetiredLocale("/en"), "/mn");
  assert.equal(withoutRetiredLocale("/ko"), "/mn");
  assert.equal(withoutRetiredLocale("/en/trips/abc"), "/mn/trips/abc");
  assert.equal(withoutRetiredLocale("/ko/admin/log-in"), "/mn/admin/log-in");
  assert.equal(withoutRetiredLocale("/mn/trips"), null);
  assert.equal(withoutRetiredLocale("/korea"), null);
  assert.equal(withoutRetiredLocale("/english"), null);
  assert.equal(withoutRetiredLocale("/"), null);
});

import { resolveSiteUrl } from "../src/lib/siteUrl.ts";

test("a localhost site address is ignored in production", () => {
  assert.equal(resolveSiteUrl("http://localhost:3000", true), "https://uudamtravel.mn");
  assert.equal(resolveSiteUrl("http://127.0.0.1:3500/", true), "https://uudamtravel.mn");
});

test("a localhost site address is kept while developing", () => {
  assert.equal(resolveSiteUrl("http://localhost:3000", false), "http://localhost:3000");
});

test("a real address is kept, trailing slash trimmed; empty falls back", () => {
  assert.equal(resolveSiteUrl("https://example.org/", true), "https://example.org");
  assert.equal(resolveSiteUrl("", true), "https://uudamtravel.mn");
  assert.equal(resolveSiteUrl(undefined, false), "https://uudamtravel.mn");
});
