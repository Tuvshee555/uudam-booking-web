"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import { ArrowRight, CalendarDays, ChevronDown, Phone, Search } from "lucide-react";

import { canonicalPath } from "@/lib/locales";
import { CONTACT, formatPhone, hasLink } from "@/lib/contact";
import { track } from "@/lib/analytics";
import { categoryHref, destinationHref, GUIDE_LINKS as GUIDES, PRIMARY_LINKS, type SiteNav } from "@/lib/siteNav";
import SearchDialog from "@/components/site/SearchDialog";
import Wordmark from "@/components/site/Wordmark";
import MobileMenu from "@/components/layout/MobileMenu";
import { cn } from "@/lib/utils";

export default function SiteHeader({ nav, overlay }: { nav: SiteNav; overlay: boolean }) {
  const pathname = usePathname() ?? "";
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // "/" opens search from anywhere, as on most catalogue sites.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      setSearchOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const transparent = overlay && !scrolled;
  const tone = transparent ? "light" : "dark";
  const tripsHref = canonicalPath("/trips");
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const linkClass = (active: boolean) =>
    cn(
      "relative inline-flex h-10 items-center whitespace-nowrap rounded-full px-2.5 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 xl:px-3.5",
      transparent
        ? "text-white/85 hover:text-white focus-visible:ring-white/70"
        : "text-foreground/75 hover:text-foreground focus-visible:ring-ring",
      active && (transparent ? "text-white" : "text-foreground"),
      active && "after:absolute after:inset-x-2.5 after:-bottom-0.5 after:h-px after:bg-gold xl:after:inset-x-3.5",
    );

  return (
    <header
      className={cn(
        "site-theme fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300",
        transparent
          ? "border-b border-transparent bg-transparent"
          : "border-b border-border/80 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80",
      )}
    >
      {transparent && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/45 to-transparent" />}
      <div className="site-container relative flex h-16 items-center gap-3 lg:h-[76px]">
        <MobileMenu nav={nav} tone={tone} />

        <Link href={canonicalPath("")} aria-label="Uudam Travel Agency — нүүр хуудас" className="rounded-full focus-ring">
          <Wordmark tone={tone} />
        </Link>

        <NavigationMenu.Root className="ml-4 hidden lg:block xl:ml-8" delayDuration={60} aria-label="Үндсэн цэс">
          <NavigationMenu.List className="flex items-center gap-0.5">
            <NavigationMenu.Item>
              <NavigationMenu.Trigger className={cn(linkClass(isActive(tripsHref) || pathname.includes("/category/")), "group gap-1")}>
                Аялалууд
                <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden="true" />
              </NavigationMenu.Trigger>
              <NavigationMenu.Content className="w-full">
                <div className="grid grid-cols-[1fr_1.35fr_0.95fr] gap-10 p-8">
                  <div>
                    <p className="eyebrow">Аяллын төрөл</p>
                    <ul className="mt-5 space-y-1">
                      {nav.categories.map((category) => (
                        <li key={category.id}>
                          <NavigationMenu.Link asChild>
                            <Link
                              href={categoryHref(category.slug)}
                              onClick={() => track("category_select", { properties: { category: category.slug, from: "menu" } })}
                              className="group flex items-baseline justify-between gap-4 rounded-md px-2 py-2 text-[15px] text-foreground focus-ring hover:bg-secondary"
                            >
                              <span className="link-draw">{category.name}</span>
                              <span className="text-xs tabular-nums text-muted-foreground">{category.count}</span>
                            </Link>
                          </NavigationMenu.Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="eyebrow">Чиглэл</p>
                    <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1">
                      {nav.destinations.map((destination) => (
                        <li key={destination.key}>
                          <NavigationMenu.Link asChild>
                            <Link
                              href={destinationHref(destination.key)}
                              onClick={() => track("destination_select", { properties: { destination: destination.key, from: "menu" } })}
                              className="group flex items-baseline justify-between gap-3 rounded-md px-2 py-2 text-[15px] text-foreground focus-ring hover:bg-secondary"
                            >
                              <span className="link-draw">{destination.label}</span>
                              <span className="text-xs tabular-nums text-muted-foreground">{destination.count}</span>
                            </Link>
                          </NavigationMenu.Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-col justify-between rounded-lg surface-night p-6">
                    <div>
                      <CalendarDays className="h-5 w-5 text-gold" aria-hidden="true" />
                      <p className="mt-4 font-display text-2xl leading-tight text-white">Хэзээ явах вэ?</p>
                      <p className="mt-2 text-sm leading-relaxed text-white/70">Хөдлөх өдрөөр нь сонгоод тухайн өдөр гарах бүх аяллыг харна уу.</p>
                    </div>
                    <div className="mt-6 space-y-3">
                      <NavigationMenu.Link asChild>
                        <Link href={canonicalPath("/departures")} className="flex items-center justify-between rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-navy-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                          Хуваарь харах
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </NavigationMenu.Link>
                      <NavigationMenu.Link asChild>
                        <Link href={tripsHref} className="flex items-center justify-between rounded-full border border-white/30 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                          Бүх {nav.tripCount} аялал
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </NavigationMenu.Link>
                    </div>
                  </div>
                </div>
              </NavigationMenu.Content>
            </NavigationMenu.Item>

            <NavigationMenu.Item>
              <NavigationMenu.Link asChild active={isActive(PRIMARY_LINKS[0].href)}>
                <Link href={PRIMARY_LINKS[0].href} className={linkClass(isActive(PRIMARY_LINKS[0].href))}>{PRIMARY_LINKS[0].label}</Link>
              </NavigationMenu.Link>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Link asChild active={isActive(PRIMARY_LINKS[1].href)}>
                <Link href={PRIMARY_LINKS[1].href} className={linkClass(isActive(PRIMARY_LINKS[1].href))}>{PRIMARY_LINKS[1].label}</Link>
              </NavigationMenu.Link>
            </NavigationMenu.Item>

            <NavigationMenu.Item>
              <NavigationMenu.Trigger className={cn(linkClass(GUIDES.some((guide) => isActive(guide.href))), "group gap-1")}>
                Зөвлөгөө
                <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden="true" />
              </NavigationMenu.Trigger>
              <NavigationMenu.Content className="w-full">
                <ul className="grid grid-cols-3 gap-4 p-8">
                  {GUIDES.map((guide) => (
                    <li key={guide.href}>
                      <NavigationMenu.Link asChild>
                        <Link href={guide.href} className="group block h-full rounded-lg border border-border bg-card p-5 transition-colors focus-ring hover:border-foreground/25">
                          <span className="font-display text-xl text-foreground">{guide.label}</span>
                          <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{guide.text}</span>
                          <ArrowRight className="mt-4 h-4 w-4 text-gold-text transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </Link>
                      </NavigationMenu.Link>
                    </li>
                  ))}
                </ul>
              </NavigationMenu.Content>
            </NavigationMenu.Item>

            {PRIMARY_LINKS.slice(2).map((link) => (
              <NavigationMenu.Item key={link.href}>
                <NavigationMenu.Link asChild active={isActive(link.href)}>
                  <Link href={link.href} className={linkClass(isActive(link.href))}>{link.label}</Link>
                </NavigationMenu.Link>
              </NavigationMenu.Item>
            ))}
          </NavigationMenu.List>

          <div className="absolute inset-x-0 top-full flex justify-center px-4 sm:px-6 lg:px-10">
            <NavigationMenu.Viewport className="site-theme relative mt-2 h-[var(--radix-navigation-menu-viewport-height)] w-full origin-top overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-panel transition-[height] duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]" />
          </div>
        </NavigationMenu.Root>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Аялал хайх"
            aria-keyshortcuts="/"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 xl:w-auto xl:gap-2 xl:px-4",
              transparent
                ? "text-white hover:bg-white/10 focus-visible:ring-white/70 xl:border xl:border-white/30"
                : "text-foreground hover:bg-secondary focus-visible:ring-ring xl:border xl:border-border",
            )}
          >
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className="hidden text-[13px] font-medium xl:inline">Хайх</span>
          </button>

          {hasLink(CONTACT.phone) && (
            <a
              href={CONTACT.phoneHref}
              onClick={() => track("phone_click", { properties: { from: "header" } })}
              aria-label={`Залгах: ${formatPhone(CONTACT.phone)}`}
              className="flex h-10 items-center gap-2 rounded-full bg-gold px-3 text-sm font-semibold text-navy-night shadow-sm transition-colors hover:bg-[hsl(41_88%_55%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {/* Beside the full menu (1024–1279px) the pill is just the icon; the number is in its label. */}
              <span className="hidden whitespace-nowrap tabular-nums sm:inline lg:hidden xl:inline">{formatPhone(CONTACT.phone)}</span>
            </a>
          )}
        </div>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} nav={nav} />
    </header>
  );
}
