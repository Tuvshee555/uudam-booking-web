import type { Metadata } from "next";

import { getCategoryTree, getTripSummaries, siteNavFrom } from "@/server/catalog";
import { getSiteSettings } from "@/server/siteSettings";
import { renderTime } from "@/server/clock";
import { shareMetadata } from "@/lib/seo";
import { DEFAULT_FAQS, DEFAULT_HOME_CUSTOM_CTA_BODY, DEFAULT_HOME_CUSTOM_CTA_TITLE, DEFAULT_HOME_HERO_EYEBROW, DEFAULT_HOME_HERO_PRIMARY_CTA, DEFAULT_HOME_HERO_SECONDARY_CTA, DEFAULT_HOME_HERO_SUBTITLE, DEFAULT_HOME_HERO_TITLE, DEFAULT_HOME_HERO_TITLE_ACCENT, parseFaqs, parseHeroImages, parseTrustFacts } from "@/lib/siteContent";
import { destinationTiles, heroSlides, nextDeparturesByTrip, openDepartureCount } from "@/lib/homeSections";
import { countryCount, tripDestinations } from "@/lib/destinations";
import { openMonths } from "@/lib/catalogFilters";
import { monthChipLabel, ulaanbaatarDay } from "@/lib/calendar";
import HomeHero from "@/components/home/HomeHero";
import TrustStrip from "@/components/home/TrustStrip";
import DestinationShowcase from "@/components/home/DestinationShowcase";
import UpcomingDepartures from "@/components/home/UpcomingDepartures";
import TripCollection from "@/components/home/TripCollection";
import TravelStyles from "@/components/home/TravelStyles";
import HowBookingWorks from "@/components/home/HowBookingWorks";
import CustomTripBand from "@/components/home/CustomTripBand";
import HomeFaq from "@/components/home/HomeFaq";
import ReviewsSection from "@/components/trust/ReviewsSection";
import RecentlyViewedStrip from "@/components/trip/RecentlyViewedStrip";

/**
 * Rendered on the server from the live catalogue. A trip save, a booking that
 * fills or reopens a date, and the daily cron refresh it at once
 * (server/revalidate.ts); the day is only a safety net.
 */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: { absolute: "Uudam Travel Agency — Аяллын багц, хөдлөх хуваарь, онлайн захиалга" },
  description:
    "Хайнан, Тайланд, Япон, Бали, Бээжин болон бусад чиглэлийн аяллын багц. Өдөр тутмын хөтөлбөр, огноо бүрийн үнэ, багтсан зүйлсийг харж онлайнаар захиална.",
  ...shareMetadata(
    "",
    "Uudam Travel Agency — Аяллын багц",
    "Өдөр тутмын хөтөлбөр, огноо бүрийн үнэ, багтсан зүйлсийг харж онлайнаар захиална.",
  ),
};

export default async function HomePage() {
  const [trips, categories, settings] = await Promise.all([getTripSummaries(), getCategoryTree(), getSiteSettings()]);
  const now = renderTime();
  const nav = siteNavFrom(trips, categories);
  const slides = heroSlides(trips, now, parseHeroImages(settings?.homeHeroImages) ?? []);
  const tiles = destinationTiles(trips, now, 7, slides.map((slide) => slide.image));
  const shownImages = new Set([...slides.map((slide) => slide.image), ...tiles.map((tile) => tile.image)]);
  const customImage = trips.find((trip) => trip.image && !shownImages.has(trip.image) && tripDestinations(trip).length === 1)?.image ?? null;
  const departures = nextDeparturesByTrip(trips, now, 6);
  const currentYear = Number(ulaanbaatarDay(now).slice(0, 4));

  const monthCounts = new Map<string, number>();
  for (const trip of trips) for (const month of openMonths(trip, now)) monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  const finder = {
    destinations: nav.destinations.map((destination) => ({ value: destination.key, label: destination.label, count: destination.count })),
    months: [...monthCounts].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ value: month, label: monthChipLabel(month, currentYear), count })),
    categories: nav.categories.map((category) => ({ value: category.id, label: category.name, count: category.count })),
  };

  const faqs = (parseFaqs(settings?.faqs) ?? []).length ? parseFaqs(settings?.faqs)! : DEFAULT_FAQS;
  const tripCount = nav.tripCount;

  return (
    <>
      <HomeHero
        slides={slides}
        eyebrow={settings?.homeHeroEyebrow || DEFAULT_HOME_HERO_EYEBROW}
        title={settings?.homeHeroTitle || DEFAULT_HOME_HERO_TITLE}
        titleAccent={settings?.homeHeroTitleAccent || DEFAULT_HOME_HERO_TITLE_ACCENT}
        subtitle={settings?.homeHeroSubtitle || DEFAULT_HOME_HERO_SUBTITLE}
        primaryCta={settings?.homeHeroPrimaryCta || DEFAULT_HOME_HERO_PRIMARY_CTA}
        secondaryCta={settings?.homeHeroSecondaryCta || DEFAULT_HOME_HERO_SECONDARY_CTA}
        finder={finder}
      />
      <TrustStrip
        tripCount={tripCount}
        destinationCount={nav.destinations.length}
        countryCount={countryCount(trips)}
        openDepartures={openDepartureCount(trips, now, 60)}
        facts={parseTrustFacts(settings?.trustFacts)}
        phoneText={settings?.trustPhoneText}
      />
      <DestinationShowcase tiles={tiles} />
      <UpcomingDepartures rows={departures} />
      <TripCollection trips={trips} categories={nav.categories} now={now} />
      <RecentlyViewedStrip />
      <TravelStyles categories={nav.categories} />
      <HowBookingWorks />
      <ReviewsSection />
      <CustomTripBand
        title={settings?.homeCustomCtaTitle || DEFAULT_HOME_CUSTOM_CTA_TITLE}
        body={settings?.homeCustomCtaBody || DEFAULT_HOME_CUSTOM_CTA_BODY}
        image={customImage}
      />
      <HomeFaq faqs={faqs.slice(0, 5)} />
    </>
  );
}
