import type { Metadata } from "next";

import PageHero from "@/components/site/PageHero";
import { getSiteSettings } from "@/server/siteSettings";
import { DEFAULT_TERMS_SECTIONS, parseTermsSections } from "@/lib/siteContent";
import { fullDateTitle } from "@/lib/calendar";
import { canonicalPath } from "@/lib/locales";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Үйлчилгээний нөхцөл",
  description: "Аяллын захиалга, төлбөр, цуцлалт, хувийн мэдээллийн нөхцөл — Uudam Travel Agency-ийн үйлчилгээний нөхцөл.",
  ...shareMetadata("/terms", "Үйлчилгээний нөхцөл · Uudam Travel", "Аяллын захиалга, төлбөр, цуцлалт, хувийн мэдээллийн нөхцөл."),
};

export const revalidate = 86400;

export default async function TermsPage() {
  const settings = await getSiteSettings();
  const parsed = parseTermsSections(settings?.termsSections);
  const custom = Boolean(parsed && parsed.length > 0);
  const sections = custom ? parsed! : DEFAULT_TERMS_SECTIONS;

  return (
    <>
      <PageHero
        compact
        crumbs={[{ label: "Нүүр", href: canonicalPath("") }, { label: "Үйлчилгээний нөхцөл" }]}
        eyebrow="Хууль эрх зүй"
        title="Үйлчилгээний нөхцөл"
        lede="Сайтаар хүсэлт, захиалга илгээх, төлбөр, цуцлалт болон хувийн мэдээллийн нөхцөл."
      >
        {/* Dated only when staff have written the terms; today's date on every visit read as a fresh revision. */}
        {custom && settings?.updatedAt && (
          <p className="text-[13px] text-muted-foreground">Тохиргоо сүүлд шинэчилсэн: {fullDateTitle(settings.updatedAt)}</p>
        )}
      </PageHero>

      <div className="site-container grid gap-12 pb-20 pt-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16 lg:pt-16">
        <nav aria-label="Агуулга" className="hidden lg:block">
          <ol className="sticky top-28 space-y-1 border-l border-border">
            {sections.map((section, index) => (
              <li key={`${section.title}-${index}`}>
                <a href={`#terms-${index + 1}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-[13.5px] leading-snug text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-ring">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="max-w-3xl space-y-10">
          {sections.map((section, index) => (
            <section key={`${section.title}-${index}`} id={`terms-${index + 1}`} className="scroll-mt-28">
              <h2 className="display-3 text-foreground">{section.title}</h2>
              <p className="mt-3 whitespace-pre-line text-[15.5px] leading-[1.8] text-ink-soft">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
