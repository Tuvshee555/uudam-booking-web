import assert from "node:assert/strict";
import test from "node:test";
import { bodyFieldNames, cleanText, isBrowserNoise, shouldRecordResponse } from "../src/lib/errorLogRules.ts";

test("every server failure and every refused staff or write request is kept", () => {
  assert.equal(shouldRecordResponse("GET", "/api/trips/norvel", 500), true);
  assert.equal(shouldRecordResponse("PUT", "/api/trips/abc", 409), true, "a refused trip save");
  assert.equal(shouldRecordResponse("POST", "/api/users/login", 401), true, "a wrong admin password");
  assert.equal(shouldRecordResponse("GET", "/api/admin/trip-health", 401), true);
  assert.equal(shouldRecordResponse("GET", "/api/trips/old-link", 404), false, "a customer's dead link is not staff work");
  assert.equal(shouldRecordResponse("POST", "/api/events", 400), false);
  assert.equal(shouldRecordResponse("POST", "/api/client-errors", 429), false, "the reporter never logs itself");
  assert.equal(shouldRecordResponse("PUT", "/api/trips/abc", 200), false);
});

test("credentials never reach the log", () => {
  const cleaned = cleanText("Bearer abcdefghijklmnop failed; password=hunter2 token: xyz eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEyMzQ1Njc4OTAifQ.c2lnbmF0dXJlc2lnbmF0dXJl");
  assert.doesNotMatch(cleaned, /abcdefghijklmnop|hunter2|xyz|eyJpZCI6/);
  assert.equal(cleanText("x".repeat(5000)).length, 1000);
});

test("browser noise nobody can fix is dropped", () => {
  assert.equal(isBrowserNoise("ResizeObserver loop completed with undelivered notifications."), true);
  assert.equal(isBrowserNoise("Script error."), true);
  assert.equal(isBrowserNoise("x is undefined", "chrome-extension://abc/content.js"), true);
  assert.equal(isBrowserNoise(""), true);
  assert.equal(isBrowserNoise("Cannot read properties of undefined (reading 'price')"), false);
});

test("a failed request is described by its field names, never its values", () => {
  assert.deepEqual(bodyFieldNames({ phone: "99112233", passport: "AB123", price: 1_734_000 }), ["phone", "passport", "price"]);
  assert.deepEqual(bodyFieldNames(null), []);
  assert.deepEqual(bodyFieldNames(["a"]), []);
});
