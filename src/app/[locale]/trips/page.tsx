import type { Metadata } from "next";
import { Suspense } from "react";

import PageHero from "@/components/site/PageHero";
import CatalogBrowser from "@/components/catalog/CatalogBrowser";
import CatalogSkeleton from "@/components/catalog/CatalogSkeleton";
import { getTripSummaries } from "@/server/catalog";
import { getPriceRanges } from "@/server/priceRanges";
import { renderTime } from "@/server/clock";
import { destinationCounts } from "@/lib/destinations";
import { ulaanbaatarDay } from "@/lib/calendar";
import { canonicalPath } from "@/lib/locales";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Бүх аялал",
  description:
    "Uudam Travel-ийн бүх аяллын багц нэг дороос. Чиглэл, хөдлөх сар, үнэ, хугацаагаар шүүж өөрт тохирох аяллаа олоорой.",
  ...shareMetadata("/trips", "Бүх аялал · Uudam Travel", "Чиглэл, хөдлөх сар, үнэ, хугацаагаар шүүж өөрт тохирох аяллаа олоорой."),
};

/**
 * Saving a trip, or a booking that fills or reopens a date, refreshes this
 * page at once (server/revalidate.ts); the daily cron moves the "upcoming"
 * cut-off along. The day is a safety net.
 */
export const revalidate = 86400;

export default async function TripsPage() {
  const [trips, prices] = await Promise.all([getTripSummaries(), getPriceRanges()]);
  const now = renderTime();
  const places = destinationCounts(trips);

  return (
    <>
      <PageHero
        compact
        crumbs={[{ label: "Нүүр", href: canonicalPath("") }, { label: "Аялалууд" }]}
        eyebrow="Аяллын каталог"
        title="Бүх аялал"
        lede={`${trips.length} аяллын багц, ${places.length} чиглэл. Чиглэл, хөдлөх сар, үнэ, хугацаагаар шүүж өөрт тохирохоо олоорой.`}
      />
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogBrowser initialTrips={trips} prices={prices} now={now} currentYear={Number(ulaanbaatarDay(now).slice(0, 4))} />
      </Suspense>
    </>
  );
}
