import { revalidatePath, revalidateTag } from "next/cache";

import { invalidateCatalog } from "@/server/cache";
import type { SeatChange } from "@/server/booking";

/**
 * Storefront pages are cached for a day (see the `revalidate` exports) and
 * refreshed when what they show changes. Each helper below marks pages; a
 * marked page re-renders on its next visit, so marking costs nothing until
 * someone looks. revalidatePath expires at once: the next visitor gets the
 * new version, never the old one.
 */

/** Every page whose content is built from the trip list: cards, the calendar, filters, related trips, hero photos. */
const TRIP_LIST_PAGES = [
  "/[locale]",
  "/[locale]/trips",
  "/[locale]/departures",
  "/[locale]/saved",
  "/[locale]/category/[id]",
  "/[locale]/discover",
  "/[locale]/discover/[slug]",
  "/[locale]/guide/[slug]",
  "/[locale]/about",
  "/[locale]/custom-trip",
];

/**
 * Every page — for what every page shows: the menu (categories, trip counts,
 * destinations) and site settings. Also the daily refresh that moves "today"
 * along (departures that have left, sales that have ended).
 */
export function revalidateStorefront() {
  invalidateCatalog();
  revalidateTag("site-nav", { expire: 0 });
  revalidatePath("/[locale]", "layout");
  revalidatePath("/sitemap.xml");
}

/**
 * Trips changed: their own pages, every page that lists trips, and the
 * sitemap — but not the other trip pages, which never show this trip. When
 * the change also moved the menu (see menuFieldsChanged in lib/siteNav), the
 * menu is on every page, so everything is refreshed.
 */
export function revalidateTrips(slugs: Iterable<string>, { menuChanged = false } = {}) {
  if (menuChanged) {
    revalidateStorefront();
    return;
  }
  invalidateCatalog();
  for (const slug of new Set(slugs)) revalidatePath(`/mn/trips/${slug}`);
  for (const page of TRIP_LIST_PAGES) revalidatePath(page, "page");
  revalidatePath("/sitemap.xml");
}

/** Something many trips show, such as a tag's name: every trip page and every list, not the menu. */
export function revalidateAllTrips() {
  invalidateCatalog();
  revalidatePath("/[locale]/trips/[slug]", "page");
  for (const page of TRIP_LIST_PAGES) revalidatePath(page, "page");
}

/** The catalogue's filters (price bands): the trip list and the category pages. */
export function revalidateCatalogFilters() {
  invalidateCatalog();
  revalidatePath("/[locale]/trips", "page");
  revalidatePath("/[locale]/category/[id]", "page");
}

/**
 * After a booking, a cancellation or an expired hold: the trip's own page
 * always (it carries the booking panel), and the lists only when a date
 * flipped between bookable and sold out — the only seat fact a list shows.
 */
export function revalidateSeatChanges(changes: Iterable<SeatChange | null | undefined>) {
  const moved = [...changes].filter((change): change is SeatChange => Boolean(change));
  if (!moved.length) return;
  if (moved.some((change) => change.availabilityChanged)) {
    revalidateTrips(moved.map((change) => change.slug));
    return;
  }
  for (const slug of new Set(moved.map((change) => change.slug))) revalidatePath(`/mn/trips/${slug}`);
}
