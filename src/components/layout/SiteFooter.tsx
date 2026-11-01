import Link from "next/link";
import { ArrowRight, Clock, MapPin } from "lucide-react";

import ThemeToggle from "@/components/theme/ThemeToggle";
import Wordmark from "@/components/site/Wordmark";
import { HorizonArcs } from "@/components/site/SunMark";
import { ChannelLink } from "@/components/site/channels";
import { CHANNELS } from "@/lib/channels";
import { CONTACT } from "@/lib/contact";
import { canonicalPath } from "@/lib/locales";
import { categoryHref, destinationHref, GUIDE_LINKS, type SiteNav } from "@/lib/siteNav";

function Column({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  if (!links.length) return null;
  return (
    <div>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">{title}</h2>
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="link-draw rounded-sm text-[14px] text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteFooter({ nav }: { nav: SiteNav }) {
  const year = new Date().getFullYear();
  const phone = CHANNELS.find((entry) => entry.key === "phone");
  const social = CHANNELS.filter((entry) => entry.key !== "phone");

  return (
    <footer className="relative isolate overflow-hidden surface-night" data-print="hide">
      <HorizonArcs className="absolute -bottom-10 left-1/2 -z-10 h-[420px] w-[1100px] -translate-x-1/2 opacity-40" />

      <div className="site-container pt-16 md:pt-24">
        <div className="grid gap-12 border-b border-white/10 pb-14 lg:grid-cols-[1.3fr_1fr] lg:gap-20 lg:pb-20">
          <div>
            <p className="eyebrow eyebrow-on-dark">Uudam Travel Agency</p>
            <p className="display-1 mt-5 max-w-xl text-balance text-white">Дараагийн аяллаа хамтдаа төлөвлөе.</p>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70">
              Хөтөлбөр, үнэ, хөдлөх огноог сайтаас харж, захиалгаа онлайнаар үлдээгээрэй. Нөхцөлийг манай ажилтан утсаар баталгаажуулна.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={canonicalPath("/trips")} className="inline-flex h-12 items-center gap-2 rounded-full bg-gold px-7 text-[15px] font-semibold text-navy-night transition-colors hover:bg-[hsl(41_88%_55%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                Аялал сонгох
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href={canonicalPath("/contact")} className="inline-flex h-12 items-center rounded-full border border-white/35 px-7 text-[15px] font-semibold text-white transition-colors hover:bg-white hover:text-navy-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                Холбоо барих
              </Link>
            </div>
          </div>

          <address className="not-italic">
            {phone && (
              <ChannelLink channelKey="phone" from="footer" className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Утсаар</span>
                <span className="mt-2 block font-display text-[2.4rem] leading-none text-white transition-colors group-hover:text-gold">{phone.value}</span>
              </ChannelLink>
            )}
            {CONTACT.otherPhones.length > 0 && (
              <p className="mt-3 text-sm tabular-nums text-white/60">{CONTACT.otherPhones.join(" · ")}</p>
            )}
            <ul className="mt-8 space-y-4 text-[14px] leading-relaxed text-white/75">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                {CONTACT.address}
              </li>
              <li className="flex gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                {CONTACT.workingHours}
              </li>
            </ul>
            <ul className="mt-8 flex flex-wrap gap-2" aria-label="Сошиал сүлжээ ба мессеж">
              {social.map((entry) => (
                <li key={entry.key}>
                  <ChannelLink
                    channelKey={entry.key}
                    from="footer"
                    ariaLabel={entry.label}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:border-gold hover:bg-gold hover:text-navy-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    <entry.icon className="h-[18px] w-[18px]" />
                  </ChannelLink>
                </li>
              ))}
            </ul>
          </address>
        </div>

        <div className="grid grid-cols-2 gap-10 py-14 md:grid-cols-4">
          <Column
            title="Аялал"
            links={[
              { href: canonicalPath("/trips"), label: `Бүх аялал${nav.tripCount ? ` (${nav.tripCount})` : ""}` },
              { href: canonicalPath("/departures"), label: "Хөдлөх хуваарь" },
              { href: canonicalPath("/custom-trip"), label: "Захиалгат аялал" },
              { href: canonicalPath("/gift"), label: "Аялал бэлэглэх" },
              { href: canonicalPath("/saved"), label: "Хадгалсан аялал" },
            ]}
          />
          <Column title="Аяллын төрөл" links={nav.categories.map((category) => ({ href: categoryHref(category.slug), label: category.name }))} />
          <Column title="Чиглэл" links={nav.destinations.slice(0, 7).map((destination) => ({ href: destinationHref(destination.key), label: destination.label }))} />
          <Column
            title="Мэдээлэл"
            links={[
              ...GUIDE_LINKS.map((link) => ({ href: link.href, label: link.label })),
              { href: canonicalPath("/about"), label: "Бидний тухай" },
              { href: canonicalPath("/contact"), label: "Холбоо барих" },
            ]}
          />
        </div>

        <div className="flex flex-col gap-6 border-t border-white/10 py-8 md:flex-row md:items-center md:justify-between">
          <Link href={canonicalPath("")} aria-label="Uudam Travel Agency — нүүр хуудас" className="w-fit rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
            <Wordmark tone="light" compact />
          </Link>
          <div className="flex flex-col gap-4 text-[13px] text-white/55 md:flex-row md:items-center md:gap-6">
            <span>© {year} Uudam Travel Agency</span>
            <Link href={canonicalPath("/terms")} className="link-draw w-fit hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">Үйлчилгээний нөхцөл</Link>
            <Link href={canonicalPath("/data-deletion")} className="link-draw w-fit hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">Хувийн мэдээлэл устгах</Link>
            <span className="flex items-center gap-2 text-white/70 [&_button]:text-white/80 [&_button:hover]:bg-white/10">
              Харагдах өнгө <ThemeToggle />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
