import { canonicalPath } from "./locales";

/** What the header menu, footer and mobile drawer list. Built on the server (getSiteNav). */
export type NavCategory = { id: string; slug: string; name: string; count: number; image: string | null };
export type NavDestination = { key: string; label: string; country: string; count: number };

export type SiteNav = {
  tripCount: number;
  categories: NavCategory[];
  destinations: NavDestination[];
};

export const EMPTY_NAV: SiteNav = { tripCount: 0, categories: [], destinations: [] };

export const GUIDE_LINKS = [
  { href: canonicalPath("/guide"), label: "Аялалд бэлтгэх", text: "Бичиг баримт, ачаа, мөнгө — явахын өмнөх жагсаалт" },
  { href: canonicalPath("/discover"), label: "Танин мэдэхүй", text: "Очих газруудын түүх, сонирхолтой баримт" },
  { href: canonicalPath("/faq"), label: "Түгээмэл асуулт", text: "Захиалга, төлбөр, хүүхдийн үнэ, цуцлалт" },
];

export const PRIMARY_LINKS = [
  { href: canonicalPath("/departures"), label: "Хуваарь" },
  { href: canonicalPath("/custom-trip"), label: "Захиалгат аялал" },
  { href: canonicalPath("/about"), label: "Бидний тухай" },
  { href: canonicalPath("/contact"), label: "Холбоо барих" },
];

export function categoryHref(slug: string): string {
  return canonicalPath(`/category/${slug}`);
}

export function destinationHref(key: string): string {
  return `${canonicalPath("/trips")}?dest=${encodeURIComponent(key)}`;
}
