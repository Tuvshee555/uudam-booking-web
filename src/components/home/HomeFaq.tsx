import { Clock } from "lucide-react";

import FaqList from "@/components/site/FaqList";
import SectionHeading, { ArrowLink } from "@/components/site/SectionHeading";
import { ChannelLink } from "@/components/site/channels";
import { CHANNELS } from "@/lib/channels";
import { CONTACT } from "@/lib/contact";
import { canonicalPath } from "@/lib/locales";
import type { FaqItem } from "@/lib/siteContent";

/** The questions people ask before booking, and the ways to ask anything else. */
export default function HomeFaq({ faqs }: { faqs: FaqItem[] }) {
  const reachable = CHANNELS.filter((entry) => ["phone", "messenger", "whatsapp", "email"].includes(entry.key));

  return (
    <section aria-labelledby="faq-title" className="site-container pb-6 pt-20 lg:pt-28">
      <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr] lg:gap-16">
        <div>
          <SectionHeading
            id="faq-title"
            eyebrow="Түгээмэл асуулт"
            title="Захиалахаас өмнө"
            action={<ArrowLink href={canonicalPath("/faq")}>Бүх асуулт</ArrowLink>}
          />
          <div className="mt-8">
            <FaqList items={faqs} idPrefix="home-faq" />
          </div>
        </div>

        <aside aria-labelledby="ask-title" className="h-fit rounded-xl border border-border bg-card p-7 lg:sticky lg:top-28 lg:p-8">
          <p className="eyebrow">Холбоо барих</p>
          <h3 id="ask-title" className="display-3 mt-4 text-foreground">Асуух зүйл байна уу?</h3>
          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">Аяллын талаар асуух, захиалга өгөхөд манай ажилтан туслана.</p>
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {reachable.map((entry) => (
              <li key={entry.key}>
                <ChannelLink channelKey={entry.key} from="home-faq" className="group flex items-center gap-4 py-3.5 focus-ring">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <entry.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] text-muted-foreground">{entry.label}</span>
                    <span className="block truncate text-[15px] font-semibold text-foreground">{entry.value}</span>
                  </span>
                </ChannelLink>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-center gap-2 text-[13px] text-muted-foreground">
            <Clock className="h-4 w-4 text-gold-text" aria-hidden="true" />
            {CONTACT.workingHours}
          </p>
        </aside>
      </div>
    </section>
  );
}
