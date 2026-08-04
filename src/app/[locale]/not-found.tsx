"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Locale-scoped so it renders inside the storefront chrome (header/footer),
 * not Next's bare default 404 — a shared trip link that's since been
 * unpublished should still feel like Uudam, not a dead end.
 *
 * Reads the locale from the URL rather than useI18n(): an invalid `[locale]`
 * segment makes the layout call notFound() before ClientI18nProvider ever
 * mounts, so this boundary can't assume that context exists.
 */
export default function NotFound() {
  const pathname = usePathname();
  const locale = pathname?.match(/^\/(mn|en|ko)(\/|$)/)?.[1] ?? "mn";
  const base = `/${locale}`;

  return (
    <div className="uudam-container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
        <Compass className="h-7 w-7" />
      </span>
      <p className="uudam-eyebrow mt-6 text-primary">404</p>
      <h1 className="mt-2 text-2xl font-bold md:text-3xl">Хуудас олдсонгүй</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        Энэ хаяг устсан, эсвэл шилжсэн байж болзошгүй. Аяллаа доороос дахин хайж үзээрэй.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href={`${base}/trips`}>Бүх аялал үзэх</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={base}>Нүүр хуудас</Link>
        </Button>
      </div>
    </div>
  );
}
