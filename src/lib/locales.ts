/**
 * The site is Mongolian only.
 *
 * /en and /ko used to exist, but they were word-for-word copies of /mn: every
 * label in the pages and every trip is Mongolian, the "translations" were
 * leftovers from an unrelated food-ordering project, and nothing in the site
 * linked to them. They still ended up in the sitemap and were tagged hreflang,
 * so Google saw three identical pages per URL and Vercel cached all three.
 * They now redirect permanently to /mn (see proxy.ts).
 *
 * If a real English or Korean version is ever written, add the locale here and
 * remove it from RETIRED_LOCALES — everything else reads this list.
 *
 * No imports in this file on purpose: the tests load it straight under Node.
 */
export const LOCALES = ["mn"] as const;
export const DEFAULT_LOCALE = "mn";

/** Locale prefixes that no longer have pages and redirect to the default one. */
export const RETIRED_LOCALES = ["en", "ko"] as const;

/** Matches a retired prefix at the start of a path: "/en", "/ko/trips/x". Not "/korea". */
export const RETIRED_LOCALE_PATTERN = /^\/(en|ko)(?=\/|$)/;

/** `/mn` + path: the one URL a page lives at. `path` excludes the locale; "" is the homepage. */
export function canonicalPath(path: string): string {
  const suffix = path === "" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${DEFAULT_LOCALE}${suffix}`;
}

/** The same path with a retired locale prefix swapped for the default one, or null if it has none. */
export function withoutRetiredLocale(pathname: string): string | null {
  const match = pathname.match(RETIRED_LOCALE_PATTERN);
  return match ? `/${DEFAULT_LOCALE}${pathname.slice(match[0].length)}` : null;
}
