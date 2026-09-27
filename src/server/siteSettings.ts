import { prisma, withPrismaRetry } from "@/server/prisma";

/**
 * Six static pages (home, about, custom-trip, gift, faq, terms) each read
 * this single row. During `next build`'s parallel static generation that's
 * six independent cold connections on top of the trip/category queries
 * every other page already makes — enough extra load on Neon's pooler to
 * intermittently fail the build with "Can't reach database server" on
 * exactly these new call sites. withPrismaRetry already exists for this
 * (see src/server/prisma.ts) but had only ever been wired into API routes.
 */
export async function getSiteSettings() {
  return withPrismaRetry(() => prisma.siteSettings.findUnique({ where: { id: "default" } }));
}
