"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Menu } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { ChannelLink } from "@/components/site/channels";
import { CHANNELS } from "@/lib/channels";
import { canonicalPath } from "@/lib/locales";
import { categoryHref, destinationHref, GUIDE_LINKS, PRIMARY_LINKS, type SiteNav } from "@/lib/siteNav";
import { cn } from "@/lib/utils";
import Wordmark from "@/components/site/Wordmark";

/**
 * The phone menu: a full-height drawer with the pages in large type, the
 * catalogue's places and trip types as shortcuts, and every way to reach a
 * person. Radix handles focus trapping, Escape and returning focus.
 */
export default function MobileMenu({ nav, tone }: { nav: SiteNav; tone: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const links = [
    { href: canonicalPath("/trips"), label: "Бүх аялал", meta: nav.tripCount ? String(nav.tripCount) : undefined },
    ...PRIMARY_LINKS.slice(0, 2),
    ...GUIDE_LINKS,
    ...PRIMARY_LINKS.slice(2),
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Цэс нээх"
        aria-expanded={open}
        className={cn(
          "-ml-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 lg:hidden",
          tone === "light" ? "text-white hover:bg-white/10 focus-visible:ring-white/70" : "text-foreground hover:bg-secondary focus-visible:ring-ring",
        )}
      >
        <Menu className="h-[22px] w-[22px]" aria-hidden="true" />
      </button>

      <SheetContent side="left" className="site-theme flex w-full max-w-[26rem] flex-col gap-0 overflow-y-auto border-r-0 p-0 sm:max-w-[26rem]">
        <SheetTitle className="sr-only">Цэс</SheetTitle>
        <SheetDescription className="sr-only">Хуудсууд, чиглэл, холбоо барих</SheetDescription>

        <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
          <Link href={canonicalPath("")} onClick={close} className="rounded-full focus-ring" aria-label="Нүүр хуудас">
            <Wordmark compact />
          </Link>
        </div>

        <nav aria-label="Үндсэн цэс" className="px-5 pt-4">
          <ul>
            {links.map((link) => (
              <li key={link.href} className="border-b border-border/70">
                <Link
                  href={link.href}
                  onClick={close}
                  className="flex items-center justify-between py-3.5 font-display text-[1.45rem] leading-tight text-foreground focus-ring"
                >
                  {link.label}
                  {"meta" in link && link.meta ? (
                    <span className="font-sans text-xs font-semibold tabular-nums text-muted-foreground">{link.meta}</span>
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {nav.destinations.length > 0 && (
          <section className="px-5 pt-7" aria-labelledby="menu-destinations">
            <p id="menu-destinations" className="eyebrow">Чиглэл</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {nav.destinations.slice(0, 12).map((destination) => (
                <li key={destination.key}>
                  <Link
                    href={destinationHref(destination.key)}
                    onClick={close}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[13px] font-medium focus-ring"
                  >
                    {destination.label}
                    <span className="text-[11px] tabular-nums text-muted-foreground">{destination.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {nav.categories.length > 0 && (
          <section className="px-5 pt-7" aria-labelledby="menu-categories">
            <p id="menu-categories" className="eyebrow">Аяллын төрөл</p>
            <ul className="mt-3">
              {nav.categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={categoryHref(category.slug)}
                    onClick={close}
                    className="flex items-center justify-between py-2.5 text-[15px] text-foreground focus-ring"
                  >
                    {category.name}
                    <span className="text-xs tabular-nums text-muted-foreground">{category.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-auto space-y-2 px-5 pb-8 pt-8" aria-label="Холбоо барих">
          {CHANNELS.filter((entry) => ["phone", "messenger", "whatsapp"].includes(entry.key)).map((entry) => (
            <ChannelLink
              key={entry.key}
              channelKey={entry.key}
              from="menu"
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold focus-ring",
                entry.key === "phone" ? "bg-gold text-navy-night" : "border border-border bg-card text-foreground",
              )}
            >
              <entry.icon className="h-[18px] w-[18px]" />
              {entry.key === "phone" ? `Залгах · ${entry.value}` : entry.label}
            </ChannelLink>
          ))}
          <div className="flex items-center justify-between pt-3 text-[13px] text-muted-foreground">
            <span>Харагдах өнгө</span>
            <ThemeToggle />
          </div>
        </section>
      </SheetContent>
    </Sheet>
  );
}
