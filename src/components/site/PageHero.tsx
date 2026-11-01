import Image from "next/image";
import type { ReactNode } from "react";

import Breadcrumbs, { type Crumb } from "@/components/site/Breadcrumbs";
import { HorizonArcs } from "@/components/site/SunMark";
import { cn } from "@/lib/utils";

/**
 * The opening band of an inner page. With a photo it is a dark, full-bleed
 * band (the photo is the subject); without one it is a quiet paper band with
 * the horizon motif, so text-only pages still open with intent.
 */
export default function PageHero({
  eyebrow,
  title,
  lede,
  crumbs,
  image,
  imageAlt = "",
  children,
  compact = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  crumbs: Crumb[];
  image?: string | null;
  imageAlt?: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  if (image) {
    return (
      <section className="relative isolate overflow-hidden surface-night">
        <Image src={image} alt={imageAlt} fill priority fetchPriority="high" sizes="100vw" quality={75} className="-z-10 object-cover opacity-60" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[hsl(var(--uudam-night))] via-[hsl(var(--uudam-night)/0.75)] to-[hsl(var(--uudam-night)/0.2)]" />
        <div className={cn("site-container", compact ? "pb-12 pt-10 md:pb-16 md:pt-14" : "pb-16 pt-12 md:pb-24 md:pt-16")}>
          <Breadcrumbs items={crumbs} tone="dark" />
          <div className="mt-8 max-w-3xl md:mt-12">
            {eyebrow && <p className="eyebrow eyebrow-on-dark rise">{eyebrow}</p>}
            <h1 className="display-1 rise rise-1 mt-4 text-balance text-white">{title}</h1>
            {lede && <p className="rise rise-2 mt-5 max-w-2xl text-pretty text-base leading-relaxed text-white/75 sm:text-lg">{lede}</p>}
            {children && <div className="rise rise-3 mt-8">{children}</div>}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative isolate overflow-hidden border-b border-border bg-sand/60">
      <HorizonArcs className="absolute -right-24 bottom-0 -z-10 hidden h-[115%] w-[60%] opacity-70 md:block" />
      <div className={cn("site-container", compact ? "pb-10 pt-8 md:pb-14 md:pt-10" : "pb-14 pt-10 md:pb-20 md:pt-14")}>
        <Breadcrumbs items={crumbs} />
        <div className="mt-8 max-w-3xl md:mt-10">
          {eyebrow && <p className="eyebrow rise">{eyebrow}</p>}
          <h1 className="display-1 rise rise-1 mt-4 text-balance text-foreground">{title}</h1>
          {lede && <p className="lede rise rise-2 mt-5 max-w-2xl text-pretty">{lede}</p>}
          {children && <div className="rise rise-3 mt-8">{children}</div>}
        </div>
      </div>
    </section>
  );
}
