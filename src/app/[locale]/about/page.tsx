import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, MapPin } from "lucide-react";

import PageHero from "@/components/site/PageHero";
import HowBookingWorks from "@/components/home/HowBookingWorks";
import { ChannelLink } from "@/components/site/channels";
import { getSiteSettings } from "@/server/siteSettings";
import { getCategoryTree, getTripSummaries, siteNavFrom } from "@/server/catalog";
import { renderTime } from "@/server/clock";
import {
  aboutIcon,
  DEFAULT_ABOUT_HERO_SUBTITLE,
  DEFAULT_ABOUT_HERO_TITLE,
  DEFAULT_ABOUT_VALUES,
  parseAboutValues,
} from "@/lib/aboutContent";
import { countryCount } from "@/lib/destinations";
import { heroSlides } from "@/lib/homeSections";
import { CONTACT } from "@/lib/contact";
import { CHANNELS } from "@/lib/channels";
import { canonicalPath } from "@/lib/locales";
import { destinationHref } from "@/lib/siteNav";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Бидний тухай",
  description:
    "Uudam Travel Agency — Улаанбаатарт байрладаг аялал жуулчлалын компани. Аяллын багц, хөдлөх хуваарь, онлайн захиалга, ажилтны баталгаажуулалт.",
  ...shareMetadata("/about", "Бидний тухай · Uudam Travel", "Аяллын багцаа нэг дор: нислэг, буудал, өдөр тутмын хөтөлбөр."),
};

export const revalidate = 86400;

export default async function AboutPage() {
  const [settings, trips, categories] = await Promise.all([getSiteSettings(), getTripSummaries(), getCategoryTree()]);
  const nav = siteNavFrom(trips, categories);

  const heroTitle = settings?.aboutHeroTitle || DEFAULT_ABOUT_HERO_TITLE;
  const heroSubtitle = settings?.aboutHeroSubtitle || DEFAULT_ABOUT_HERO_SUBTITLE;
  const values = parseAboutValues(settings?.aboutValues) || [];
  const cards = values.length > 0 ? values : DEFAULT_ABOUT_VALUES;
  const image = heroSlides(trips, renderTime(), [], 3)[2]?.image ?? heroSlides(trips, renderTime(), [], 1)[0]?.image;
  const countries = countryCount(trips);

  return (
    <>
      <PageHero
        crumbs={[{ label: "Нүүр", href: canonicalPath("") }, { label: "Бидний тухай" }]}
        eyebrow="Uudam Travel Agency"
        title={heroTitle}
        lede={heroSubtitle}
        image={image}
      />

      <section aria-labelledby="about-what" className="site-container grid gap-10 py-20 lg:grid-cols-[1fr_1.1fr] lg:gap-20 lg:py-28">
        <div>
          <p className="eyebrow">Бид юу хийдэг вэ</p>
          <h2 id="about-what" className="display-2 mt-4 text-balance text-foreground">Аяллын багцаа нэг дороос — сонгохоос буцаж ирэх хүртэл</h2>
        </div>
        <div className="space-y-5 text-[16px] leading-[1.8] text-ink-soft">
          <p>
            Uudam Travel Agency нь Улаанбаатарт байрладаг аялал жуулчлалын компани. Бид нислэг, зочид буудал, өдөр тутмын хөтөлбөрийг
            нэг багц болгон зохион байгуулдаг.
          </p>
          <p>
            Одоо {nav.tripCount} аяллын багцаар {countries} улсын {nav.destinations.length} чиглэлд аялал санал болгож байна. Аялал бүрийн хуудсанд
            хөтөлбөр, огноо бүрийн үнэ, багцад багтсан зүйлсийг нээлттэй харуулж, захиалгыг тань манай ажилтан холбогдож баталгаажуулна.
          </p>
          <dl className="grid grid-cols-3 gap-4 border-y border-border py-6">
            <div>
              <dt className="text-[12px] text-muted-foreground">Аяллын багц</dt>
              <dd className="numeral mt-1 text-[2.2rem] leading-none text-foreground">{nav.tripCount}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted-foreground">Чиглэл</dt>
              <dd className="numeral mt-1 text-[2.2rem] leading-none text-foreground">{nav.destinations.length}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted-foreground">Улс</dt>
              <dd className="numeral mt-1 text-[2.2rem] leading-none text-foreground">{countries}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="about-values" className="bg-sand/60 py-20 lg:py-28">
        <div className="site-container">
          <p className="eyebrow">Бидний ажиллах зарчим</p>
          <h2 id="about-values" className="display-2 mt-4 max-w-2xl text-balance text-foreground">Ил тод, хүнлэг, танд тохирсон</h2>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
            {cards.map(({ icon, title, text }, index) => {
              const Icon = aboutIcon(icon);
              return (
                <li key={`${title}-${index}`} className="bg-card p-8">
                  <Icon className="h-6 w-6 text-gold-text" aria-hidden="true" />
                  <h3 className="mt-5 text-[18px] font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {nav.destinations.length > 0 && (
        <section aria-labelledby="about-places" className="site-container pt-20 lg:pt-28">
          <p className="eyebrow">Бидний чиглэлүүд</p>
          <h2 id="about-places" className="display-2 mt-4 text-foreground">Одоо хаашаа аялуулж байна</h2>
          <ul className="mt-10 flex flex-wrap gap-2.5">
            {nav.destinations.map((place) => (
              <li key={place.key}>
                <Link href={destinationHref(place.key)} className="inline-flex h-12 items-center gap-2.5 rounded-full border border-border bg-card px-5 text-[15px] font-semibold text-foreground focus-ring hover:border-foreground/35">
                  {place.label}
                  <span className="text-[12.5px] font-normal tabular-nums text-muted-foreground">{place.count} аялал</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <HowBookingWorks />

      <section aria-labelledby="about-contact" className="site-container py-20 lg:py-28">
        <div className={`grid overflow-hidden rounded-xl surface-night ${CHANNELS.length ? "lg:grid-cols-[1.2fr_1fr]" : ""}`}>
          <div className="p-8 sm:p-12">
            <p className="eyebrow eyebrow-on-dark">Холбоо барих</p>
            <h2 id="about-contact" className="display-2 mt-4 text-white">Манай оффист ирж эсвэл утсаар уулзаарай</h2>
            <ul className="mt-8 space-y-4 text-[15px] leading-relaxed text-white/80">
              <li className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />{CONTACT.address}</li>
              <li className="flex gap-3"><Clock className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />{CONTACT.workingHours}</li>
            </ul>
            <Link href={canonicalPath("/contact")} className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-gold px-7 text-[15px] font-semibold text-navy-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              Бүх холбоо барих хэлбэр <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {CHANNELS.length > 0 && <ul className="grid content-center gap-px border-t border-white/10 bg-white/10 lg:border-l lg:border-t-0">
            {CHANNELS.filter((entry) => ["phone", "messenger", "whatsapp", "email"].includes(entry.key)).map((entry) => (
              <li key={entry.key} className="bg-[hsl(var(--uudam-night))]">
                <ChannelLink channelKey={entry.key} from="about" className="group flex items-center gap-4 px-8 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold">
                  <entry.icon className="h-5 w-5 text-gold" />
                  <span className="min-w-0">
                    <span className="block text-[12px] text-white/55">{entry.label}</span>
                    <span className="block truncate text-[16px] font-semibold text-white group-hover:text-gold">{entry.value}</span>
                  </span>
                </ChannelLink>
              </li>
            ))}
          </ul>}
        </div>
      </section>
    </>
  );
}
