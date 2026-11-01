"use client";

import Link from "next/link";

import { SunMark } from "@/components/site/SunMark";

/**
 * Locale-scoped so it renders inside the storefront chrome (header/footer),
 * not Next's bare default 404 — a shared trip link that's since been
 * unpublished should still feel like Uudam, not a dead end.
 *
 * Links use the one live locale directly rather than useI18n(): an invalid
 * `[locale]` segment makes the layout call notFound() before
 * ClientI18nProvider ever mounts, so this boundary can't assume that context.
 */
export default function NotFound() {
  return (
    <div className="site-container flex min-h-[64vh] flex-col items-center justify-center py-20 text-center">
      <SunMark className="h-14 w-14 text-foreground" />
      <p className="eyebrow mt-8">404</p>
      <h1 className="display-1 mt-4 text-foreground">Хуудас олдсонгүй</h1>
      <p className="lede mt-4 max-w-md">Энэ хаяг устсан эсвэл шилжсэн байж магадгүй. Аяллаа доороос дахин хайж үзээрэй.</p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Link href="/mn/trips" className="inline-flex h-12 items-center rounded-full bg-gold px-7 text-[15px] font-semibold text-navy-night focus-ring">Бүх аялал үзэх</Link>
        <Link href="/mn" className="inline-flex h-12 items-center rounded-full border border-border bg-card px-7 text-[15px] font-semibold text-foreground focus-ring">Нүүр хуудас</Link>
      </div>
    </div>
  );
}
