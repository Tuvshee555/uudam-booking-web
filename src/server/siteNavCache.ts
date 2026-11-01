import { unstable_cache } from "next/cache";

import { prisma } from "@/server/prisma";
import { getCategoryTree, getSiteNav, siteNavFrom } from "@/server/catalog";
import type { Trip } from "@/types/trip";

/**
 * The menu every storefront page renders: trip and category counts and the
 * destinations, shared by all pages. Kept for a day; anything that moves it
 * expires the "site-nav" tag (revalidateStorefront), which also refreshes
 * every page, so the cached copy always matches what the pages show.
 *
 * unstable_cache names an entry by the function's source text plus the key
 * parts. Each route is bundled on its own, so getSiteNav compiles to different
 * text in the layout and in an API route, and each kept a separate copy: the
 * API routes compared the database with their own stale menu, not the pages'.
 * A bound function reads the same everywhere ("function () { [native code] }"),
 * so "site-nav" alone names the one entry the pages render.
 */
export const getCachedSiteNav = unstable_cache(getSiteNav.bind(null), ["site-nav"], {
  revalidate: 86_400,
  tags: ["site-nav"],
});

/**
 * Whether the database now gives a different menu from the one the pages were
 * rendered with — for changes that bypass this app's own saves: the chatbot
 * publishing or withdrawing a trip straight in this database, or a script.
 * Reads only the columns the menu is built from, not the full trip list.
 */
export async function menuChangedSinceRender(): Promise<boolean> {
  const [rendered, trips, categories] = await Promise.all([
    getCachedSiteNav(),
    prisma.trip.findMany({
      where: { isPublished: true },
      select: { id: true, title: true, country: true, city: true, destinations: true },
      orderBy: { createdAt: "desc" },
    }),
    getCategoryTree(),
  ]);
  const current = siteNavFrom(trips as unknown as Trip[], categories);
  return JSON.stringify(rendered) !== JSON.stringify(current);
}
