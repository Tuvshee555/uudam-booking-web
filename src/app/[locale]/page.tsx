import type { Metadata } from "next";

import { getCategoryTree, getPublishedTrips } from "@/server/catalog";
import { localeAlternates } from "@/lib/hreflang";
import { parseHeroImages } from "@/lib/siteContent";
import { getSiteSettings } from "@/server/siteSettings";
import TrustBar from "@/components/trust/TrustBar";
import ReviewsSection from "@/components/trust/ReviewsSection";
import HomeClient from "./HomeClient";

/**
 * The homepage previously rendered zero trip cards and no categories in its
 * initial HTML — every list came from a client fetch. It is the page most
 * likely to be crawled, linked and screenshotted, so it is now seeded on the
 * server like the catalogue and trip pages.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { languages: localeAlternates("") },
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [trips, categories, settings] = await Promise.all([
    getPublishedTrips(),
    getCategoryTree(),
    getSiteSettings(),
  ]);

  return (
    <HomeClient
      initialTrips={trips}
      initialCategories={categories}
      trustBar={<TrustBar settings={settings} />}
      reviewsSection={<ReviewsSection locale={locale} />}
      heroEyebrow={settings?.homeHeroEyebrow}
      heroTitle={settings?.homeHeroTitle}
      heroTitleAccent={settings?.homeHeroTitleAccent}
      heroSubtitle={settings?.homeHeroSubtitle}
      heroImages={parseHeroImages(settings?.homeHeroImages) ?? null}
      heroPrimaryCta={settings?.homeHeroPrimaryCta}
      heroSecondaryCta={settings?.homeHeroSecondaryCta}
      heroBadge={settings?.homeHeroBadge}
      customCtaTitle={settings?.homeCustomCtaTitle}
      customCtaBody={settings?.homeCustomCtaBody}
    />
  );
}
