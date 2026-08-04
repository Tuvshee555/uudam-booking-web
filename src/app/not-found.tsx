import Link from "next/link";
import Image from "next/image";

/**
 * Root-level 404: as of Next.js 16, only `app/not-found.tsx` catches URLs
 * that don't match any route at all — a nested `[locale]/not-found.tsx`
 * only fires when `notFound()` is thrown from inside that segment (see
 * node_modules/next/dist/docs/.../not-found.md). Since the storefront chrome
 * (header, footer, react-query) only mounts inside `[locale]/layout.tsx`,
 * this page can't use any of it and stays deliberately self-contained —
 * hence the raw Tailwind instead of the usual Button/i18n components.
 */
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Image src="/uudam-logo.jpg" alt="Uudam Travel Agency" width={44} height={44} className="rounded-md" />
      <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-[hsl(41,87%,45%)]">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-[hsl(209,45%,12%)] md:text-3xl">
        Хуудас олдсонгүй
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[hsl(215,16%,47%)]">
        Энэ хаяг устсан, эсвэл шилжсэн байж болзошгүй. Аяллаа доороос дахин хайж үзээрэй.
      </p>
      <Link
        href="/mn"
        className="mt-8 inline-flex items-center justify-center rounded-lg bg-[hsl(209,72%,24%)] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        Нүүр хуудас руу буцах
      </Link>
    </div>
  );
}
