import { prisma, withPrismaRetry } from "@/server/prisma";
import { BRAND } from "@/lib/brand";
import { brandCopy } from "@/lib/brandTrip";

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
  const row = await withPrismaRetry(() => prisma.siteSettings.findUnique({ where: { id: "default" } }));
  return brandSettings(row);
}

/* Facts that belong to the company, not the brand: the bank account holder and the numbers. */
const SHARED_FACTS = new Set(["bankDetails", "contactPhone", "contactOtherPhones", "id", "updatedAt", "createdAt"]);

function renameDeep(value: unknown): unknown {
  if (typeof value === "string") return brandCopy(value);
  if (Array.isArray(value)) return value.map(renameDeep);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, renameDeep(entry)]));
  }
  return value;
}

/**
 * The Settings row is shared: copy staff wrote for the primary brand (hero, about, FAQ, terms)
 * reads with this brand's name on a secondary brand (lib/brand.ts). The same row on uudamtravel.mn.
 */
export function brandSettings<T>(row: T): T {
  if (BRAND.isPrimary || !row || typeof row !== "object") return row;
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, SHARED_FACTS.has(key) ? value : renameDeep(value)]),
  ) as T;
}
