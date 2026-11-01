"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

/**
 * Catches render/data errors anywhere under a locale segment so a broken
 * page shows a branded recovery screen instead of Next's default crash
 * overlay. Deliberately avoids useI18n(): whatever threw may have thrown
 * before ClientI18nProvider finished mounting.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="site-container flex min-h-[64vh] flex-col items-center justify-center py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="display-2 mt-6 text-foreground">Хуудсыг ачаалж чадсангүй</h1>
      <p className="lede mt-3 max-w-md">Түр зуурын алдаа гарлаа. Дахин оролдоно уу, эсвэл ажилтантай шууд холбогдоорой.</p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-[15px] font-semibold text-primary-foreground focus-ring">
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          Дахин оролдох
        </button>
        <Link href="/mn" className="inline-flex h-12 items-center rounded-full border border-border bg-card px-7 text-[15px] font-semibold text-foreground focus-ring">Нүүр хуудас</Link>
      </div>
    </div>
  );
}
