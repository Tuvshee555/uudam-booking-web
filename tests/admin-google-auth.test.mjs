import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

const SECRET = "x".repeat(8) + "Q7f!kP2zR9mW4tY6vB1nC3dE5gH8jL0s";
process.env.JWT_SECRET = SECRET;
process.env.ADMIN_GOOGLE_EMAILS = "Owner@Example.com, staff@example.com";
process.env.GOOGLE_CLIENT_ID = "client-1";
process.env.GOOGLE_CLIENT_SECRET = "client-secret";

const google = await import("../src/server/googleAuth.ts");
const auth = await import("../src/server/session.ts");

const idToken = (claims) =>
  ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");
const goodClaims = (over = {}) => ({
  iss: "https://accounts.google.com",
  aud: "client-1",
  exp: Math.floor(Date.now() / 1000) + 600,
  email: "Staff@Example.com",
  email_verified: true,
  ...over,
});
const allowed = () => google.allowedAdminEmails();

test("the allow-list is lower-cased and split on commas or spaces", () => {
  assert.deepEqual(google.parseAllowedEmails(" A@x.mn,b@x.mn  c@x.mn, not-an-email "), ["a@x.mn", "b@x.mn", "c@x.mn"]);
  assert.deepEqual(allowed(), ["owner@example.com", "staff@example.com"]);
});

test("a listed, verified Google account passes; everything else is refused", () => {
  assert.deepEqual(google.checkGoogleIdToken(idToken(goodClaims()), "client-1", allowed()), { ok: true, email: "staff@example.com" });
  const refused = (claims) => google.checkGoogleIdToken(idToken(goodClaims(claims)), "client-1", allowed());
  assert.equal(refused({ email: "stranger@example.com" }).error, "google_email_not_allowed");
  assert.equal(refused({ email_verified: false }).error, "google_email_unverified");
  assert.equal(refused({ aud: "someone-elses-app" }).error, "google_token_invalid");
  assert.equal(refused({ iss: "https://evil.example" }).error, "google_token_invalid");
  assert.equal(refused({ exp: Math.floor(Date.now() / 1000) - 1 }).error, "google_token_invalid");
  assert.equal(google.checkGoogleIdToken("garbage", "client-1", allowed()).error, "google_token_invalid");
});

test("sign-in is off unless Google, the allow-list and a strong JWT_SECRET are all set", () => {
  const env = { GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", ADMIN_GOOGLE_EMAILS: "a@x.mn", JWT_SECRET: SECRET };
  assert.equal(google.googleSignInAvailable(env), true);
  assert.equal(google.googleSignInAvailable({ ...env, JWT_SECRET: "admin" }), false);
  assert.equal(google.googleSignInAvailable({ ...env, JWT_SECRET: "a".repeat(40) }), false);
  assert.equal(google.googleSignInAvailable({ ...env, ADMIN_GOOGLE_EMAILS: "" }), false);
  assert.equal(google.googleSignInAvailable({ ...env, GOOGLE_CLIENT_SECRET: "" }), false);
});

test("a session minted by Google sign-in verifies while its address stays on the list", () => {
  const token = auth.signAccessToken({ id: "u1", role: "ADMIN", email: "Owner@Example.com" });
  assert.deepEqual(auth.verifySessionToken(token), { id: "u1", role: "ADMIN", email: "owner@example.com" });

  process.env.ADMIN_GOOGLE_EMAILS = "staff@example.com";
  assert.equal(auth.verifySessionToken(token), null, "taken off the list → locked out at once");
  process.env.ADMIN_GOOGLE_EMAILS = "Owner@Example.com, staff@example.com";
});

test("password-era, reset, forged and weak-key tokens are all refused", () => {
  const sign = (payload, secret = SECRET, options = {}) => jwt.sign(payload, secret, { expiresIn: "1h", ...options });
  const base = { id: "u1", role: "ADMIN", email: "owner@example.com" };
  assert.equal(auth.verifySessionToken(sign({ ...base, type: "access" })), null, "old password login token (no via)");
  assert.equal(auth.verifySessionToken(sign({ ...base, type: "reset", via: "google" })), null, "reset token");
  assert.equal(auth.verifySessionToken(sign({ ...base, type: "access", via: "google" }, "another-secret-another-secret-xyz12")), null);
  assert.equal(auth.verifySessionToken(sign({ ...base, type: "access", via: "google" }, SECRET, { expiresIn: -10 })), null, "expired");
  assert.equal(auth.verifySessionToken(sign({ ...base, email: undefined, type: "access", via: "google" })), null, "no email");
  const unsigned = jwt.sign({ ...base, type: "access", via: "google" }, "", { algorithm: "none" });
  assert.equal(auth.verifySessionToken(unsigned), null, "alg=none");

  const good = auth.signAccessToken(base);
  process.env.JWT_SECRET = "admin";
  assert.equal(auth.verifySessionToken(good), null, "weak key → nobody gets in");
  assert.throws(() => auth.signAccessToken(base));
  process.env.JWT_SECRET = SECRET;
});

test("the landing path after sign-in can only be an admin page of this site", () => {
  assert.equal(google.safeAdminReturnPath("/mn/admin/trips?status=draft"), "/mn/admin/trips?status=draft");
  assert.equal(google.safeAdminReturnPath("/mn/admin"), "/mn/admin");
  for (const bad of ["https://evil.example", "//evil.example", "/mn/trips", "/mn/admin/../../x", "javascript:alert(1)", "", null]) {
    assert.equal(google.safeAdminReturnPath(bad), "/mn/admin", String(bad));
  }
});

test("the state cookie round-trips the landing path and states compare safely", () => {
  const cookie = google.googleStateCookie("abc123", "/mn/admin/bookings", true);
  assert.match(cookie, /HttpOnly; SameSite=Lax; Max-Age=600; Secure$/);
  assert.match(cookie, /Path=\/api\/admin\/google;/);
  const value = cookie.split(";")[0].split("=")[1];
  assert.deepEqual(google.readGoogleStateCookie(value), { state: "abc123", returnPath: "/mn/admin/bookings" });
  assert.equal(google.statesMatch("abc", "abc"), true);
  assert.equal(google.statesMatch("abc", "abd"), false);
  assert.equal(google.statesMatch("", ""), false);
  assert.match(google.handoffCookie("t", true), /Max-Age=60; Secure$/);
});

test("production always signs in on uudamtravel.mn; dev uses the request's own host", () => {
  const req = new Request("https://uudam-booking-web.vercel.app/api/admin/google/start");
  assert.equal(google.signInOrigin(req, true), "https://uudamtravel.mn");
  assert.equal(google.signInOrigin(new Request("http://localhost:3500/api/admin/google/start"), false), "http://localhost:3500");
  assert.equal(google.googleRedirectUri("https://uudamtravel.mn"), "https://uudamtravel.mn/api/admin/google/callback");
});
