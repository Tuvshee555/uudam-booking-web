import { cache } from "react";

import { prisma, withPrismaRetry } from "@/server/prisma";
import { priceRangesFrom, PRICES, type PriceRange } from "@/lib/catalogFilters";

/**
 * The catalogue's price filter: staff-defined bands if any, else the default
 * ranges. Read once per render, like the trip list (see getTripSummaries).
 */
export const getPriceRanges = cache(async (): Promise<PriceRange[]> => {
  try {
    const bands = await withPrismaRetry(() => prisma.priceBand.findMany({ orderBy: { sortOrder: "asc" } }));
    return priceRangesFrom(bands);
  } catch (error) {
    console.error("Price bands unavailable:", error);
    return PRICES;
  }
});
