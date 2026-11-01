import type { Metadata } from "next";

import PageHero from "@/components/site/PageHero";
import FaqList from "@/components/site/FaqList";
import JsonLd from "@/components/content/JsonLd";
import { ChannelLink } from "@/components/site/channels";
import { getSiteSettings } from "@/server/siteSettings";
import { CHANNELS } from "@/lib/channels";
import { canonicalPath } from "@/lib/locales";
import { DEFAULT_FAQS, parseFaqs, type FaqItem } from "@/lib/siteContent";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Түгээмэл асуулт",
  description:
    "Захиалга хэрхэн явагдах, хэзээ баталгаажих, төлбөр, хүүхдийн үнэ, бичиг баримт, виз, ачаа, цуцлалт — Uudam Travel-ийн түгээмэл асуултын хариулт.",
  ...shareMetadata("/faq", "Түгээмэл асуулт · Uudam Travel", "Захиалга, төлбөр, бичиг баримт, цуцлалтын талаарх түгээмэл асуултын хариулт."),
};

export const revalidate = 300;

const OTHER = "Бусад";

export default async function FaqPage() {
  const settings = await getSiteSettings();
  const parsed = parseFaqs(settings?.faqs);
  const faqs: FaqItem[] = parsed && parsed.length > 0 ? parsed : DEFAULT_FAQS;

  // Staff-written questions have no topic; they read as one list.
  const groups = new Map<string, FaqItem[]>();
  for (const item of faqs) {
    const topic = item.topic || OTHER;
    groups.set(topic, [...(groups.get(topic) ?? []), item]);
  }
  const topics = [...groups.keys()];
  const grouped = topics.length > 1 || topics[0] !== OTHER;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <JsonLd id="faq-json-ld" data={jsonLd} />
      <PageHero
        compact
        crumbs={[{ label: "Нүүр", href: canonicalPath("") }, { label: "Түгээмэл асуулт" }]}
        eyebrow="Түгээмэл асуулт"
        title="Асуулт, хариулт"
        lede="Захиалга, төлбөр, бичиг баримт, аяллын бэлтгэлийн талаар хамгийн олон асуудаг зүйлс. Хариулт олдохгүй бол шууд холбогдоорой."
      />

      <div className="site-container grid gap-12 pb-20 pt-12 lg:grid-cols-[15rem_minmax(0,1fr)_17rem] lg:gap-14 lg:pt-16">
        {grouped && (
          <nav aria-label="Сэдэв" className="hidden lg:block">
            <ul className="sticky top-28 space-y-1 border-l border-border">
              {topics.map((topic, index) => (
                <li key={topic}>
                  <a href={`#topic-${index + 1}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-[14px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-ring">
                    {topic}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className={grouped ? "min-w-0 space-y-14" : "min-w-0 lg:col-span-2"}>
          {[...groups].map(([topic, items], index) => (
            <section key={topic} id={`topic-${index + 1}`} aria-labelledby={`topic-${index + 1}-title`} className="scroll-mt-28">
              {grouped && <h2 id={`topic-${index + 1}-title`} className="display-3 mb-4 text-foreground">{topic}</h2>}
              <FaqList items={items} idPrefix={`faq-${index + 1}`} />
            </section>
          ))}
        </div>

        <aside className="h-fit rounded-xl border border-border bg-card p-6 lg:sticky lg:top-28">
          <p className="eyebrow">Хариулт олдсонгүй юу</p>
          <p className="mt-3 text-[15px] font-semibold text-foreground">Ажилтанаас шууд асуугаарай</p>
          <ul className="mt-4 space-y-2">
            {CHANNELS.filter((entry) => ["phone", "messenger", "whatsapp"].includes(entry.key)).map((entry) => (
              <li key={entry.key}>
                <ChannelLink channelKey={entry.key} from="faq" className="flex h-11 items-center gap-3 rounded-full border border-border px-4 text-[14px] font-semibold text-foreground focus-ring hover:border-foreground/35">
                  <entry.icon className="h-4 w-4 text-gold-text" />
                  {entry.key === "phone" ? entry.value : entry.label}
                </ChannelLink>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
