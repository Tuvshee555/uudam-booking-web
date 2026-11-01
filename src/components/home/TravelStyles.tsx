import Link from "next/link";
import { ArrowRight, Bus, Compass, Plane, Route, Ship, Snowflake } from "lucide-react";

import SectionHeading from "@/components/site/SectionHeading";
import { HorizonArcs } from "@/components/site/SunMark";
import { categoryHref, type NavCategory } from "@/lib/siteNav";

/** An icon that says what the category's name says. */
function iconFor(name: string) {
  const text = name.toLowerCase();
  if (/круз|усан онгоц/.test(text)) return Ship;
  if (/өвл/.test(text)) return Snowflake;
  if (/газар/.test(text) && /нислэг/.test(text)) return Route;
  if (/нислэг/.test(text)) return Plane;
  if (/газр/.test(text)) return Bus;
  return Compass;
}

/** The trip types on sale, as a dark band — the site's one full-width navy moment. */
export default function TravelStyles({ categories }: { categories: NavCategory[] }) {
  if (!categories.length) return null;

  return (
    <section aria-labelledby="styles-title" className="relative isolate mt-20 overflow-hidden surface-night py-20 lg:mt-28 lg:py-28">
      <HorizonArcs className="absolute -bottom-24 right-[-10%] -z-10 h-[520px] w-[900px] opacity-50" />
      <div className="site-container grid gap-12 lg:grid-cols-[0.9fr_1.5fr] lg:gap-20">
        <SectionHeading
          id="styles-title"
          className="lg:self-start"
          tone="dark"
          eyebrow="Аяллын төрөл"
          title="Яаж аялахаа сонго"
          description="Улаанбаатараас шууд нислэгээр, газраар, эсвэл хоёуланг хослуулан — аялал бүр аль төрөлд багтахыг тэмдэглэсэн."
        />
        <ul className="border-t border-white/15">
          {categories.map((category) => {
            const Icon = iconFor(category.name);
            return (
              <li key={category.id} className="border-b border-white/15">
                <Link
                  href={categoryHref(category.slug)}
                  className="group flex items-center gap-5 py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:gap-6"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 text-gold transition-colors group-hover:border-gold group-hover:bg-gold group-hover:text-navy-night">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 font-display text-[1.45rem] leading-tight text-white sm:text-[1.9rem]">{category.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-white/60">{category.count} аялал</span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-white/50 transition-all group-hover:translate-x-1 group-hover:text-gold" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
