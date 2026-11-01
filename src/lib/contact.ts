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

function configuredAddress(): string {
  const value = (process.env.NEXT_PUBLIC_ADDRESS ?? "").trim();
  return value && value !== SAMPLE_ADDRESS ? value : OFFICE_ADDRESS;
}

export const CONTACT = {
  /** Digits only where possible — used for the tel: link. */
  phone: process.env.NEXT_PUBLIC_PHONE || "",
  phoneHref: `tel:${(process.env.NEXT_PUBLIC_PHONE || "").replace(/[^\d+]/g, "")}`,

  /**
   * The other numbers on the agency's trip posters (the office line first).
   * The main number above stays the one every button calls.
   */
  otherPhones: ["7713 6633", "8913 6633", "9924 8000"],

  email: process.env.NEXT_PUBLIC_EMAIL || "",

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
    const raw = process.env.NEXT_PUBLIC_WHATSAPP || process.env.NEXT_PUBLIC_PHONE || "";
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
