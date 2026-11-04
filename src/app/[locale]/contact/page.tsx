import type { Metadata } from "next";
import { Clock, ExternalLink, MapPin } from "lucide-react";

import PageHero from "@/components/site/PageHero";
import ContactForm from "@/components/lead/ContactForm";
import { ChannelLink } from "@/components/site/channels";
import { CHANNELS } from "@/lib/channels";
import { CONTACT, telHref } from "@/lib/contact";
import { canonicalPath } from "@/lib/locales";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Холбоо барих",
  description:
    "Uudam Travel Agency-тэй утас, Messenger, WhatsApp, и-мэйлээр холбогдож аяллын талаар асууж, захиалга өгнө үү. Оффисын хаяг, ажлын цаг.",
  ...shareMetadata("/contact", "Холбоо барих · Uudam Travel", "Утас, Messenger, WhatsApp, и-мэйлээр холбогдож аяллын талаар асууж, захиалга өгнө үү."),
};

export const revalidate = 86400;

const HINTS: Record<string, string> = {
  phone: "Хамгийн хурдан — ажлын цагаар",
  messenger: "Facebook хуудсаар бичих",
  whatsapp: "Гадаадаас холбогдоход тохиромжтой",
  email: "Бичиг баримт, дэлгэрэнгүй асуулт",
  facebook: "Шинэ аялал, мэдээлэл",
  instagram: "Аяллын зураг, бичлэг",
};

export default function ContactPage() {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.address)}`;

  return (
    <>
      <PageHero
        compact
        crumbs={[{ label: "Нүүр", href: canonicalPath("") }, { label: "Холбоо барих" }]}
        eyebrow="Холбоо барих"
        title="Бидэнтэй холбогдоорой"
        lede="Аялал сонгох, захиалах, асуух зүйл бүрт манай ажилтан туслана. Танд тохиромжтой сувгаа сонгоорой."
      />

      <div className="site-container grid gap-12 pb-20 pt-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:pt-16">
        <div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CHANNELS.map((entry) => (
              <li key={entry.key} className={entry.key === "phone" ? "sm:col-span-2" : undefined}>
                <ChannelLink
                  channelKey={entry.key}
                  from="contact"
                  className="group flex h-full items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors focus-ring hover:border-foreground/30"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <entry.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] text-muted-foreground">{entry.label} · {HINTS[entry.key]}</span>
                    <span className={entry.key === "phone" ? "mt-0.5 block font-display text-[1.75rem] leading-tight text-foreground" : "mt-0.5 block truncate text-[15.5px] font-semibold text-foreground"}>
                      {entry.value}
                    </span>
                  </span>
                </ChannelLink>
              </li>
            ))}
          </ul>

          {CONTACT.otherPhones.length > 0 && (
            <div className="mt-3 rounded-xl border border-border bg-card p-5">
              <p className="text-[12.5px] text-muted-foreground">Бусад утас</p>
              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {CONTACT.otherPhones.map((number) => (
                  <li key={number}>
                    <a href={telHref(number)} className="link-draw text-[16px] font-semibold tabular-nums text-foreground">{number}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <MapPin className="h-5 w-5 text-gold-text" aria-hidden="true" />
              <h2 className="mt-4 text-[15px] font-semibold text-foreground">Оффисын хаяг</h2>
              <address className="mt-1.5 text-[14.5px] not-italic leading-relaxed text-muted-foreground">{CONTACT.address}</address>
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground underline decoration-gold underline-offset-4 focus-ring">
                Газрын зураг дээр харах <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <Clock className="h-5 w-5 text-gold-text" aria-hidden="true" />
              <h2 className="mt-4 text-[15px] font-semibold text-foreground">Ажлын цаг</h2>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">{CONTACT.workingHours}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Сайтаар илгээсэн захиалга, асуултад ажлын цагаар хариулна.</p>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          <ContactForm />
        </div>
      </div>
    </>
  );
}
