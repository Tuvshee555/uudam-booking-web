const LOCALES = ["mn", "en", "ko"] as const;

/**
 * `alternates.languages` for a locale-prefixed path, so Google understands
 * /mn, /en and /ko are the same page in different languages rather than
 * duplicate or competing content. `path` excludes the locale segment, e.g.
 * "/trips/tokio-fuji-ayalal", "" for the homepage.
 */
export function localeAlternates(path: string): Record<string, string> {
  // "" (homepage) must stay "" — prefixing it would produce a trailing-slash
  // URL ("/mn/") that doesn't match the site's actual routes ("/mn").
  const suffix = path === "" ? "" : path.startsWith("/") ? path : `/${path}`;

  return Object.fromEntries(LOCALES.map((locale) => [locale, `/${locale}${suffix}`]));
}
