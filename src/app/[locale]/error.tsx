"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Catches render/data errors anywhere under a locale segment so a broken
 * page shows a branded recovery screen instead of Next's default crash
 * overlay. Deliberately avoids useI18n(): whatever threw may have thrown
 * before ClientI18nProvider finished mounting, so this can't assume that
 * context is available.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const locale = pathname?.match(/^\/(mn|en|ko)(\/|$)/)?.[1] ?? "mn";

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="uudam-container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="h-7 w-7" />
      </span>
      <h1 className="mt-6 text-2xl font-bold md:text-3xl">Ямар нэг зүйл буруу ажиллалаа</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        Хуудсыг ачаалахад алдаа гарлаа. Дахин оролдоно уу, эсвэл нүүр хуудас руу буцаарай.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>
          <RotateCw className="mr-2 h-4 w-4" />
          Дахин оролдох
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={`/${locale}`}>Нүүр хуудас</Link>
        </Button>
      </div>
    </div>
  );
}
