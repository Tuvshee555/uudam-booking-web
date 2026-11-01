import type { MetadataRoute } from "next";

import { prisma } from "@/server/prisma";
import { LOCALES } from "@/lib/locales";
import { SITE_URL } from "@/lib/siteUrl";

// /saved is deliberately absent: the list lives in the visitor's browser, so
// there is nothing there for a crawler to index.
const STATIC_PATHS = [
  "",
  "/trips",
  "/departures",
  "/custom-trip",
  "/gift",
  "/guide",
  "/discover",
  "/about",
  "/contact",
  "/faq",
  "/terms",
  "/data-deletion",
];

/**
 * Built once at deploy otherwise. A trip save refreshes it at once
 * (revalidateStorefront); the hour is the fallback for anything else.
 */
export const revalidate = 3600;

/**
 * Every published trip and category in every live locale (only Mongolian — see lib/locales.ts), plus the
 * static pages. /admin is deliberately excluded — see robots.ts.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [trips, categories, posts, articles] = await Promise.all([
    prisma.trip.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
    // A category with nothing published is a thin page (and noindex): leave it out.
    prisma.category.findMany({
      where: {
        OR: [
          { trips: { some: { isPublished: true } } },
          { primaryTrips: { some: { isPublished: true } } },
        ],
      },
      select: { id: true, slug: true },
    }),
    prisma.post.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.knowledgeArticle.findMany({
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

    for (const article of articles) {
      entries.push({
        url: `${SITE_URL}/${locale}/discover/${article.slug}`,
        lastModified: article.updatedAt,
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
