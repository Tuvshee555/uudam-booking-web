import type { Metadata } from "next";

import PageHero from "@/components/site/PageHero";
import { getTripSummaries } from "@/server/catalog";
import { canonicalPath } from "@/lib/locales";
import SavedPageClient from "./SavedPageClient";

export const metadata: Metadata = {
  title: "Хадгалсан аялал",
  description: "Дараа үзэхээр хадгалсан аяллууд.",
  // The list lives in the visitor's browser, so there is nothing here for a
  // crawler and nothing that should ever surface in search.
  robots: { index: false, follow: true },
};

/** The list is read from the visitor's browser; the trip data under it is refreshed with every trip change (server/revalidate.ts). */
export const revalidate = 86400;

export default async function SavedPage() {
  return (
    <>
      <PageHero
        compact
        crumbs={[{ label: "Нүүр", href: canonicalPath("") }, { label: "Хадгалсан аялал" }]}
        eyebrow="Таны жагсаалт"
        title="Хадгалсан аялал"
        lede="Аяллын зураг дээрх ♡ товчоор хадгалсан аяллууд. Жагсаалт зөвхөн энэ төхөөрөмж дээр хадгалагдана."
      />
      <SavedPageClient initialTrips={await getTripSummaries()} />
    </>
  );
}
