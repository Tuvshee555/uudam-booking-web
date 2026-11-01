import type { Metadata } from "next";
import { Suspense } from "react";

import PageHero from "@/components/site/PageHero";
import { getTripSummaries } from "@/server/catalog";
import { renderTime } from "@/server/clock";
import { ulaanbaatarDay } from "@/lib/calendar";
import { upcomingDepartures } from "@/lib/departures";
import { canonicalPath } from "@/lib/locales";
import { shareMetadata } from "@/lib/seo";
import DeparturesPageClient from "./DeparturesPageClient";

export const metadata: Metadata = {
  title: "Аяллын хуваарь",
  description:
    "Uudam Travel-ийн ойрын хугацаанд хөдлөх бүх аялал хуанлиар. Хэзээ явахаа мэдэж байгаа бол өдрөө сонгоод тухайн өдөр гарах аяллуудыг харна уу.",
  ...shareMetadata("/departures", "Аяллын хуваарь · Uudam Travel", "Ойрын хугацаанд хөдлөх аяллуудыг хуанлиар харна уу."),
};

/**
 * Saving a trip, or a booking that fills or reopens a date, refreshes this
 * page at once (server/revalidate.ts). The daily cron (00:00 UTC, when dates
 * stored at UTC midnight roll over) moves "today" along: the calendar opens on
 * the current Ulaanbaatar month and never lists a departure that has left.
 */
export const revalidate = 86400;

export default async function DeparturesPage() {
  const now = renderTime();
  const trips = (await getTripSummaries()).filter((trip) => upcomingDepartures(trip, now).length > 0);

  return (
    <>
      <PageHero
        compact
        crumbs={[{ label: "Нүүр", href: canonicalPath("") }, { label: "Хуваарь" }]}
        eyebrow="Хөдлөх хуваарь"
        title="Хэзээ явах вэ?"
        lede="Өдрөө сонгоход тухайн өдөр хөдлөх бүх аялал, тухайн огнооны үнийн хамт гарна. Дүүрсэн огноог зурааслан тэмдэглэсэн."
      />
      <Suspense fallback={<div className="site-container h-[640px] animate-pulse pt-10" aria-busy="true" />}>
        <DeparturesPageClient trips={trips} today={ulaanbaatarDay(now)} now={now} />
      </Suspense>
    </>
  );
}
