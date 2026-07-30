/**
 * Agency contact details — the single place to change them.
 *
 * Everything the customer can tap to reach a human lives here: the site sells
 * nothing online, so these links *are* the conversion path. Values come from
 * env so they can differ per deployment, with working defaults for local dev.
 *
 * To point at the real Facebook page, set NEXT_PUBLIC_FACEBOOK_PAGE (and
 * NEXT_PUBLIC_MESSENGER_URL, which is usually m.me/<page-handle>).
 */

export const CONTACT = {
  /** Digits only where possible — used for the tel: link. */
  phone: process.env.NEXT_PUBLIC_PHONE || "",
  phoneHref: `tel:${(process.env.NEXT_PUBLIC_PHONE || "").replace(/[^\d+]/g, "")}`,

  email: process.env.NEXT_PUBLIC_EMAIL || "",

  facebook: process.env.NEXT_PUBLIC_FACEBOOK_PAGE ?? "https://facebook.com",
  messenger: process.env.NEXT_PUBLIC_MESSENGER_URL ?? "https://m.me",
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM ?? "",

  address:
    process.env.NEXT_PUBLIC_ADDRESS ??
    "Чингэлтэй дүүрэг, 4-р хороо, Анкарагийн гудамж-23 “Tod tower” оффис, 701, Улаанбаатар, Монгол",
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
