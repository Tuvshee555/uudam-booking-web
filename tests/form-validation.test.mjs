import assert from "node:assert/strict";
import test from "node:test";

import { emailError, formatPhoneInput, nameError, phoneError } from "../src/lib/formValidation.ts";

test("phone numbers are grouped as they are typed", () => {
  assert.equal(formatPhoneInput("99112233"), "9911 2233");
  assert.equal(formatPhoneInput("9911"), "9911");
  assert.equal(formatPhoneInput("99112"), "9911 2");
  assert.equal(formatPhoneInput("+97699112233"), "+976 9911 2233");
  assert.equal(formatPhoneInput("+14155550123"), "+14155550123");
});

test("the rules match what the enquiry and booking APIs accept", () => {
  assert.equal(phoneError("9911 2233"), null);
  assert.equal(phoneError("+976 9911 2233"), null);
  assert.equal(phoneError("97699112233"), null, "976 without the plus is still Mongolian");
  assert.equal(phoneError("+1 415 555 0123"), null, "a foreign number with its country code");
  assert.match(phoneError("9911") ?? "", /8 оронтой/);
  assert.match(phoneError("") ?? "", /оруулна/);
});

test("names and optional emails", () => {
  assert.match(nameError(" ") ?? "", /Нэрээ/);
  assert.equal(nameError("Болд"), null);
  assert.equal(emailError(""), null, "email is optional");
  assert.equal(emailError("bold@example.mn"), null);
  assert.match(emailError("bold@") ?? "", /буруу/);
});
