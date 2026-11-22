/**
 * Agency contact details — the single place to change them.
 *
 * Everything the customer can tap to reach a human lives here: these links
 * *are* the conversion path. Values come from env so they can differ per
 * deployment, with working defaults for local dev.
 *
 * To point at the real Facebook page, set NEXT_PUBLIC_FACEBOOK_PAGE (and
 * NEXT_PUBLIC_MESSENGER_URL, which is usually m.me/<page-handle>).
 */

/**
 * The office address printed on every one of the agency's own trip posters.
 * Used unless NEXT_PUBLIC_ADDRESS holds a real address: production carried
 * .env.example's sample "Улаанбаатар, Монгол", which is only the city.
 */
const OFFICE_ADDRESS = "Чингэлтэй дүүрэг, 4-р хороо, Анхарагийн гудамж-23, «Todtower» оффис, 701 тоот, Улаанбаатар";
const SAMPLE_ADDRESS = "Улаанбаатар, Монгол";

/**
 * A secondary brand (lib/brand.ts) shares the primary brand's contact details unless it is given
 * its own: NEXT_PUBLIC_BRAND_PHONE / _OTHER_PHONES (comma-separated) / _EMAIL / _ADDRESS win when
 * set. Unset everywhere today, so both brands show the same numbers.
 */
const BRAND_PHONE = (process.env.NEXT_PUBLIC_BRAND_PHONE ?? "").trim();
const BRAND_OTHER_PHONES = (process.env.NEXT_PUBLIC_BRAND_OTHER_PHONES ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .slice(0, 6);

function configuredAddress(): string {
  const own = (process.env.NEXT_PUBLIC_BRAND_ADDRESS ?? "").trim();
  if (own) return own;
  const value = (process.env.NEXT_PUBLIC_ADDRESS ?? "").trim();
  return value && value !== SAMPLE_ADDRESS ? value : OFFICE_ADDRESS;
}

export const CONTACT = {
  /** Digits only where possible — used for the tel: link. */
  phone: BRAND_PHONE || process.env.NEXT_PUBLIC_PHONE || "",
  phoneHref: `tel:${(BRAND_PHONE || process.env.NEXT_PUBLIC_PHONE || "").replace(/[^\d+]/g, "")}`,

  /**
   * The other numbers on the agency's trip posters (the office line first).
   * The main number above stays the one every button calls.
   */
  // A brand with its own main number lists only its own extra numbers (none unless set), never the
  // primary's poster numbers.
  otherPhones: (BRAND_PHONE || BRAND_OTHER_PHONES.length ? BRAND_OTHER_PHONES : ["7713 6633", "8913 6633", "9924 8000"]) as string[],

  email: process.env.NEXT_PUBLIC_BRAND_EMAIL || process.env.NEXT_PUBLIC_EMAIL || "",

  facebook: process.env.NEXT_PUBLIC_FACEBOOK_PAGE ?? "https://facebook.com",
  messenger: process.env.NEXT_PUBLIC_MESSENGER_URL ?? "https://m.me",
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM ?? "",

  /**
   * wa.me needs the full international number with no "+", spaces or
   * leading zero. Staff only ever type the local 8-digit number, so a bare
   * digit-only value is assumed local and gets Mongolia's 976 prefixed;
   * NEXT_PUBLIC_WHATSAPP can override with an already-international number.
   */
  whatsapp: (() => {
    const raw = BRAND_PHONE || process.env.NEXT_PUBLIC_WHATSAPP || process.env.NEXT_PUBLIC_PHONE || "";
    const digits = raw.replace(/[^\d]/g, "");
    if (!digits) return "";
    const international = digits.startsWith("976") ? digits : `976${digits}`;
    return `https://wa.me/${international}`;
  })(),

  address: configuredAddress(),
  workingHours: process.env.NEXT_PUBLIC_WORKING_HOURS ?? "Даваа–Баасан 09:00–18:00",
} as const;

/**
 * True when a link is actually configured, so we don't render dead buttons.
 *
 * `||` on purpose, not `??`: an admin leaving `NEXT_PUBLIC_PHONE=""` in the
 * env file is a defined-but-empty string, which `??` would treat as "set" and
 * happily render a blank button with a dead `tel:` href. Phone and email get
 * the exact same treatment Facebook/Messenger already had.
 */
export function hasLink(value: string) {
  return Boolean(value && value !== "https://facebook.com" && value !== "https://m.me");
}

/** "91172769" → "9117 2769"; anything that is not a bare 8-digit number is left as typed. */
export function formatPhone(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  return digits.length === 8 && !/[^\d\s-]/.test(value) ? `${digits.slice(0, 4)} ${digits.slice(4)}` : value;
}

export function telHref(value: string): string {
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

/**
 * The phone numbers staff change in admin Settings (SiteSettings.contactPhone / contactOtherPhones,
 * since 2026-11-22). Every number on the site comes from here: the server reads it with
 * getContactPhones (server/contactPhones.ts), the browser from ContactProvider. Unset falls back to
 * NEXT_PUBLIC_PHONE and the poster numbers above, so nothing changes until someone saves one.
 */
export type ContactPhones = { phone: string; otherPhones: string[] };

export const DEFAULT_PHONES: ContactPhones = { phone: CONTACT.phone, otherPhones: CONTACT.otherPhones };

export function phonesFrom(row: { contactPhone?: string | null; contactOtherPhones?: unknown } | null | undefined): ContactPhones {
  const saved = typeof row?.contactPhone === "string" && row.contactPhone.trim() ? row.contactPhone.trim() : null;
  const others = Array.isArray(row?.contactOtherPhones)
    ? row.contactOtherPhones.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean).slice(0, 6)
    : null;
  // A brand's own numbers (BRAND_PHONE / BRAND_OTHER_PHONES above) win over the shared Settings row;
  // a brand with its own main number never inherits the primary's extra numbers.
  return {
    phone: BRAND_PHONE || saved || DEFAULT_PHONES.phone,
    otherPhones: BRAND_PHONE || BRAND_OTHER_PHONES.length ? BRAND_OTHER_PHONES : others ?? DEFAULT_PHONES.otherPhones,
  };
}

/** wa.me for a number: NEXT_PUBLIC_WHATSAPP (already international) wins; a local 8-digit number gets 976. */
export function whatsappHref(phone: string): string {
  const digits = ((BRAND_PHONE ? phone : process.env.NEXT_PUBLIC_WHATSAPP || phone) || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits.startsWith("976") ? digits : `976${digits}`}`;
}
/** A number as staff type it ("9117 2769", "+976 9117-2769"): 6–15 digits. Null when empty, false when not a number. */
export function cleanPhoneInput(value: unknown): string | null | false {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return false;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  if (/[^\d\s+()-]/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "").length;
  return digits >= 6 && digits <= 15 ? trimmed : false;
}
