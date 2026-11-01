import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import SectionHeading, { ArrowLink } from "@/components/site/SectionHeading";
import type { DestinationTile } from "@/lib/homeSections";
import { canonicalPath } from "@/lib/locales";
import { formatMnt } from "@/lib/pricing";
import { destinationHref } from "@/lib/siteNav";
import { cn } from "@/lib/utils";

/**
 * Places, not packages: an editorial mosaic of the destinations on sale,
 * each photographed with one of its own trips. A swipeable row on phones.
 */
export default function DestinationShowcase({ tiles }: { tiles: DestinationTile[] }) {
  if (tiles.length < 3) return null;
  const [lead, ...rest] = tiles;

  return (
    <section aria-labelledby="destinations-title" className="site-container pt-20 lg:pt-28">
      <SectionHeading
        id="destinations-title"
        eyebrow="Чиглэлүүд"
        title="Хаашаа явахаа эндээс сонго"
        description="Далайн эрэг, түүхэн хот, уулын байгаль — одоо захиалга авч буй чиглэлүүд."
        action={<ArrowLink href={canonicalPath("/trips")}>Бүх аялал</ArrowLink>}
      />

      <ul className="no-scrollbar -mx-4 mt-10 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-pl-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:grid-rows-[repeat(2,minmax(0,17rem))] lg:gap-4 lg:overflow-visible lg:px-0">
        {[lead, ...rest].map((tile, index) => (
          <li
            key={tile.destination.key}
            className={cn(
              "w-[72%] shrink-0 snap-start sm:w-[44%] lg:w-auto",
              index === 0 && "lg:col-span-2 lg:row-span-2",
              index > 4 && "lg:hidden",
            )}
          >
            <Link
              href={destinationHref(tile.destination.key)}
              className="group relative flex aspect-[4/5] h-full flex-col justify-end overflow-hidden rounded-lg bg-navy-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:aspect-auto"
            >
              <Image
                src={tile.image}
                alt=""
                fill
                sizes={index === 0 ? "(max-width: 1024px) 72vw, 50vw" : "(max-width: 1024px) 72vw, 25vw"}
                quality={70}
                className="photo-zoom object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <div className="relative flex items-end justify-between gap-3 p-5 lg:p-6">
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-gold">{tile.destination.country}</p>
                  <h3 className={cn("mt-2 font-display leading-tight text-white", index === 0 ? "text-[2rem] lg:text-[2.6rem]" : "text-[1.6rem]")}>
                    {tile.destination.label}
                  </h3>
                  <p className="mt-1.5 text-[13px] text-white/80">
                    {tile.count} аялал{tile.fromPrice ? ` · ${formatMnt(tile.fromPrice)}-с` : ""}
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40 text-white transition-colors group-hover:border-gold group-hover:bg-gold group-hover:text-navy-night">
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
