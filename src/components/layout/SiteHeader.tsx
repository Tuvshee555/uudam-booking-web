"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Phone, Search, X } from "lucide-react";

import { useCategoryTree } from "@/hooks/useTrips";
import { CONTACT, hasLink } from "@/lib/contact";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export default function SiteHeader() {
  const pathname = usePathname();
  const { locale } = useI18n();
  const { data: categories } = useCategoryTree();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Closed on tap rather than in an effect keyed on the pathname: tapping the
  // page you're already on wouldn't fire the effect and the drawer would stick.
  const closeMobile = () => setMobileOpen(false);

  const base = `/${locale}`;

  const nav = [
    { href: `${base}/trips`, label: "Аялалууд" },
    { href: `${base}/about`, label: "Бидний тухай" },
    { href: `${base}/contact`, label: "Холбоо барих" },
  ];

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-shadow",
        scrolled ? "shadow-sm" : "shadow-none",
      )}
    >
      <div className="uudam-navy-surface">
        <div className="uudam-container flex h-16 items-center gap-4">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg p-2 text-white/90 hover:bg-white/10 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Цэс нээх"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href={base} className="flex items-center gap-2.5">
            <Image
              src="/uudam-logo.jpg"
              alt="Uudam Travel Agency"
              width={36}
              height={36}
              className="rounded-md"
              priority
            />
            <span className="hidden flex-col leading-none sm:flex">
              <span className="text-[15px] font-extrabold tracking-wide text-white">UUDAM</span>
              <span className="uudam-eyebrow mt-0.5 text-[9px]">Travel Agency</span>
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {nav.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href={`${base}/trips`}
              className="inline-flex items-center justify-center rounded-lg p-2 text-white/90 hover:bg-white/10"
              aria-label="Аялал хайх"
            >
              <Search className="h-5 w-5" />
            </Link>

            <ThemeToggle />

            {/* The phone number is the primary call to action — the agency
                closes on the phone, not on this site. Hidden rather than a
                dead button when no real number is configured yet. */}
            {hasLink(CONTACT.phone) && (
              <a
                href={CONTACT.phoneHref}
                className="ml-1 inline-flex items-center gap-2 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-navy-deep transition-opacity hover:opacity-90"
              >
                <Phone className="h-4 w-4" />
                <span className="hidden sm:inline">{CONTACT.phone}</span>
                <span className="sr-only sm:hidden">Залгах</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {categories && categories.length > 0 && (
        <div className="hidden border-b border-border bg-background lg:block">
          <div className="uudam-container flex h-11 items-center gap-1 overflow-x-auto no-scrollbar">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`${base}/category/${category.slug ?? category.id}`}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
              >
                {category.categoryName}
                {category.tripCount > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground/70">
                    {category.tripCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[300px] p-0">
          <SheetTitle className="sr-only">Цэс</SheetTitle>

          <div className="uudam-navy-surface flex items-center justify-between px-5 py-4">
            <span className="text-base font-extrabold tracking-wide">UUDAM</span>
            <button type="button" onClick={closeMobile} aria-label="Хаах">
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex flex-col p-3">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {categories && categories.length > 0 && (
            <div className="border-t border-border p-3">
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ангилал
              </p>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`${base}/category/${category.slug ?? category.id}`}
                  onClick={closeMobile}
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-secondary"
                >
                  {category.categoryName}
                </Link>
              ))}
            </div>
          )}

          {hasLink(CONTACT.phone) && (
            <div className="border-t border-border p-3">
              <a
                href={CONTACT.phoneHref}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground"
              >
                <Phone className="h-4 w-4" />
                {CONTACT.phone}
              </a>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </header>
  );
}
