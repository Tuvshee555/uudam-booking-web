import type { MetadataRoute } from "next";

import { prisma } from "@/server/prisma";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://uudamtravel.mn";
const LOCALES = ["mn", "en", "ko"] as const;

// /saved is deliberately absent: the list lives in the visitor's browser, so
// there is nothing there for a crawler to index.
const STATIC_PATHS = [
  "",
  "/trips",
  "/departures",
  "/custom-trip",
  "/gift",
  "/guide",
  "/about",
  "/contact",
  "/faq",
  "/terms",
  "/data-deletion",
];

/**
 * Every published trip and category, crossed with every locale, plus the
 * static pages. /admin is deliberately excluded — see robots.ts.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [trips, categories, posts] = await Promise.all([
    prisma.trip.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.category.findMany({
      select: { id: true, slug: true },
    }),
    prisma.post.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: `${SITE_URL}/${locale}${path}`,
        changeFrequency: path === "" ? "daily" : "weekly",
        priority: path === "" ? 1 : 0.6,
      });
    }

    for (const trip of trips) {
      entries.push({
        url: `${SITE_URL}/${locale}/trips/${trip.slug}`,
        lastModified: trip.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    for (const post of posts) {
      entries.push({
        url: `${SITE_URL}/${locale}/guide/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }

    for (const category of categories) {
      entries.push({
        url: `${SITE_URL}/${locale}/category/${category.slug ?? category.id}`,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  return entries;
}
