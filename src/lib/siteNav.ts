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

type MenuFields = {
  isPublished: boolean;
  title: string;
  country?: string | null;
  city?: string | null;
  destinations?: string[] | null;
  categoryId?: string | null;
  categories?: { id: string }[];
};

/**
 * Whether a trip edit changes the menu: the published trip count, which
 * categories have trips, and the destinations (worked out from the title,
 * country, city and destination list — see tripDestinations). The menu is on
 * every page, so such an edit refreshes them all (server/revalidate.ts).
 */
export function menuFieldsChanged(before: MenuFields | null, after: MenuFields | null): boolean {
  if (!before?.isPublished && !after?.isPublished) return false;
  if (!before || !after || before.isPublished !== after.isPublished) return true;
  const facts = (trip: MenuFields) =>
    JSON.stringify([
      trip.title,
      trip.country ?? null,
      trip.city ?? null,
      [...(trip.destinations ?? [])].sort(),
      trip.categoryId ?? null,
      (trip.categories ?? []).map((category) => category.id).sort(),
    ]);
  return facts(before) !== facts(after);
}

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
