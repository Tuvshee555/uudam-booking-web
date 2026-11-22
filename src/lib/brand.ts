/**
 * Which agency this deployment is.
 *
 * One codebase and one database serve two brands. Uudam Travel (uudamtravel.mn) is the primary
 * deployment: it owns the admin panel, the analytics and every write to shared rows. «Магнай
 * Травел» (NEXT_PUBLIC_BRAND=magnai) is the same catalogue under its own name, logo and theme,
 * with every adult and child fare lower (lib/brandPricing.ts). Unset, or any other value, is
 * Uudam — a deployment without the variable is exactly the original site.
 *
 * NEXT_PUBLIC_ so the browser bundle and the server agree: Next inlines it at build time.
 * No imports on purpose: the tests load this file straight under Node.
 */
export type BrandKey = "uudam" | "magnai";

export type Brand = {
  key: BrandKey;
  /** Owns the admin panel, analytics and every write to shared data (trips, settings, holds). */
  isPrimary: boolean;
  /** Full name: page titles, JSON-LD, share cards, emails. */
  name: string;
  /** The name in "… · <shortName>" title suffixes and running copy. */
  shortName: string;
  /** Header/footer lockup: the bold word and the small line under it. */
  wordmark: string;
  wordmarkTagline: string;
  /** Canonical address when NEXT_PUBLIC_SITE_URL is unset (lib/siteUrl.ts). */
  productionUrl: string;
  logo: string;
  /** Small round mark beside the wordmark (displayed at 44 px). */
  mark: string;
  icon512: string;
  appleIcon: string;
  favicon: string;
  /** 1200×630 share card for pages without a photo of their own. */
  ogImage: string;
  themeColor: string;
  /** Plain colours for places CSS variables cannot reach (emails, map markers, the crash page). */
  navyHex: string;
  goldHex: string;
  /** Where staff manage the catalogue, enquiries and settings for both brands. */
  adminUrl: string;
  /** Online booking (seat hold + bank transfer/QPay) — the primary brand's merchant only. */
  onlineBooking: boolean;
  /** First-party visit tracking (TripView/AnalyticsEvent rows) — Uudam's admin reports read them. */
  analytics: boolean;
  /** Customer reviews were written about Uudam, so only Uudam shows them. */
  testimonials: boolean;
};

const UUDAM: Brand = {
  key: "uudam",
  isPrimary: true,
  name: "Uudam Travel Agency",
  shortName: "Uudam Travel",
  wordmark: "UUDAM",
  wordmarkTagline: "Travel Agency",
  productionUrl: "https://uudamtravel.mn",
  logo: "/uudam-logo.jpg",
  mark: "/uudam-mark-96.webp",
  icon512: "/icon-512.png",
  appleIcon: "/apple-icon.png",
  favicon: "/favicon.ico",
  ogImage: "/og-default.jpg",
  themeColor: "#0a2540",
  navyHex: "#113e67",
  goldHex: "#f2bd4a",
  adminUrl: "https://uudamtravel.mn/mn/admin",
  onlineBooking: true,
  analytics: true,
  testimonials: true,
};

const MAGNAI: Brand = {
  key: "magnai",
  isPrimary: false,
  name: "Магнай Травел",
  shortName: "Магнай Травел",
  wordmark: "MAGNAI",
  wordmarkTagline: "Travel",
  productionUrl: "https://magnai-travel.vercel.app",
  logo: "/brands/magnai/logo.png",
  mark: "/brands/magnai/mark-96.webp",
  icon512: "/brands/magnai/icon-512.png",
  appleIcon: "/brands/magnai/apple-icon.png",
  favicon: "/brands/magnai/favicon.png",
  ogImage: "/brands/magnai/og-default.jpg",
  themeColor: "#011c3a",
  navyHex: "#052851",
  goldHex: "#dd9f3c",
  adminUrl: "https://uudamtravel.mn/mn/admin",
  onlineBooking: false,
  analytics: false,
  testimonials: false,
};

export function brandFor(value: string | undefined): Brand {
  return (value ?? "").trim().toLowerCase() === "magnai" ? MAGNAI : UUDAM;
}

export const BRAND: Brand = brandFor(process.env.NEXT_PUBLIC_BRAND);

/** Fare discount in tögrög. Only a secondary brand ever discounts; Uudam is always 0. */
export function brandDiscountFor(brand: Brand, configured: string | undefined): number {
  if (brand.isPrimary) return 0;
  const raw = (configured ?? "").trim();
  const value = raw ? Number(raw) : 50_000;
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

export const BRAND_DISCOUNT_MNT = brandDiscountFor(BRAND, process.env.BRAND_DISCOUNT_MNT);

/**
 * Copy the primary brand wrote in shared rows (trip descriptions, articles, settings) carries
 * its name. On a secondary brand those words become the secondary name; Uudam text is returned
 * untouched. Longest spellings first so "Uudam Travel Agency" is not left as "Magnai Travel Agency".
 * Case-sensitive on purpose: lower-case "uudam" lives in photo URLs and folder names
 * (…/uudam-travel-trips/…), which must keep pointing at the same files.
 */
const RENAMES: Array<[RegExp, string]> = [
  [/UUDAM\s+TRAVEL\s+AGENCY/g, "MAGNAI TRAVEL"],
  [/Uudam\s+Travel\s+Agency/g, "Magnai Travel"],
  [/UUDAM\s+TRAVEL/g, "MAGNAI TRAVEL"],
  [/Uudam\s+Travel/g, "Magnai Travel"],
  [/UUDAM/g, "MAGNAI"],
  [/Uudam/g, "Magnai"],
  [/ҮҮДЭМ\s+ТР[ЭА]В[ЭЕ]Л/g, "МАГНАЙ ТРАВЕЛ"],
  [/Үүдэм\s+[Тт]р[эа]в[эе]л/g, "Магнай Травел"],
  [/ҮҮДЭМ/g, "МАГНАЙ"],
  [/Үүдэм/g, "Магнай"],
  [/УУДАМ/g, "МАГНАЙ"],
  [/Уудам/g, "Магнай"],
];

const OWN_HOST = /(?:https?:\/\/)?(?:www\.)?uudamtravel\.mn(?=[/\s"'<>)»,.]|$)/gi;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** The primary brand's name and site address in shared copy, as the secondary brand's. */
export function renameBrandIn(text: string, brand: Brand = BRAND, siteUrl: string = brand.productionUrl): string {
  if (brand.isPrimary || !text) return text;
  let out = text.replace(OWN_HOST, (match) => (/^https?:\/\//i.test(match) ? siteUrl.replace(/\/+$/, "") : hostOf(siteUrl)));
  for (const [pattern, replacement] of RENAMES) out = out.replace(pattern, replacement);
  return out;
}

/**
 * Leads from a secondary brand land in the same queues (Enquiry.source, Booking.source) as the
 * primary brand's. The source is prefixed with the brand key — "magnai:/mn/trips/x" — so Uudam's
 * admin can badge them and staff call back under the right name and price. Primary: unchanged.
 */
export function brandLeadSource(source: string | null | undefined, brand: Brand = BRAND): string | null {
  const value = (source ?? "").trim();
  if (brand.isPrimary) return value || null;
  return `${brand.key}:${value}`.slice(0, 120);
}

/** Which brand a lead came from, and its source without the brand prefix (admin display). */
export function leadBrandOf(source: string | null | undefined): { brand: Brand | null; source: string | null } {
  const match = (source ?? "").match(/^(magnai):([\s\S]*)$/);
  if (!match) return { brand: null, source: source ?? null };
  return { brand: brandFor(match[1]), source: match[2] || null };
}
