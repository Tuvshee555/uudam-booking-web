import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PHONES, cleanPhoneInput, formatPhone, hasLink, phonesFrom, telHref, whatsappHref } from "../src/lib/contact.ts";

// The phone numbers became an admin setting (2026-11-22): the saved ones win, unset falls back.

test("saved numbers win; nothing saved keeps today's numbers", () => {
  assert.deepEqual(phonesFrom(null), DEFAULT_PHONES);
  assert.deepEqual(phonesFrom({ contactPhone: "  ", contactOtherPhones: null }), DEFAULT_PHONES);
  assert.deepEqual(phonesFrom({ contactPhone: "8800 1122", contactOtherPhones: ["7000 1111", "", 5, " 9000 2222 "] }),
    { phone: "8800 1122", otherPhones: ["7000 1111", "9000 2222"] });
  assert.deepEqual(phonesFrom({ contactPhone: "8800 1122", contactOtherPhones: [] }).otherPhones, [], "an empty saved list shows no extra numbers");
});

test("the call and WhatsApp links are built from the saved number (lib/channels.ts buildChannels)", () => {
  const { phone } = phonesFrom({ contactPhone: "8800 1122" });
  assert.equal(telHref(phone), "tel:88001122");
  assert.equal(formatPhone(phone), "8800 1122");
  if (!process.env.NEXT_PUBLIC_WHATSAPP) assert.equal(whatsappHref(phone), "https://wa.me/97688001122");
  if (!process.env.NEXT_PUBLIC_WHATSAPP) assert.equal(whatsappHref("+976 8800-1122"), "https://wa.me/97688001122");
  assert.equal(hasLink(""), false, "no number, no dead button");
});

test("what staff type is accepted as a number, anything else is refused", () => {
  assert.equal(cleanPhoneInput("9117 2769"), "9117 2769");
  assert.equal(cleanPhoneInput("+976  9117-2769"), "+976 9117-2769");
  assert.equal(cleanPhoneInput(""), null);
  assert.equal(cleanPhoneInput(undefined), null);
  assert.equal(cleanPhoneInput("утас 9117"), false);
  assert.equal(cleanPhoneInput("123"), false);
  assert.equal(cleanPhoneInput(91172769), false);
});
