"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import TripCard from "@/components/trip/TripCard";
import SectionHeading from "@/components/site/SectionHeading";
import { sortTrips } from "@/lib/catalogFilters";
import { canonicalPath } from "@/lib/locales";
import type { NavCategory } from "@/lib/siteNav";
import type { Trip } from "@/types/trip";
import { cn } from "@/lib/utils";

type Tab = { key: string; label: string; pick: (trips: Trip[]) => Trip[]; href: string };

/**
 * A browsable shelf of packages: the soonest to leave, the newest, and one
 * tab per trip type. Tabs are buttons over data already on the page, so
 * switching is instant; the link under the grid opens the full catalogue
 * filtered the same way.
 */
export default function TripCollection({ trips, categories, now }: { trips: Trip[]; categories: NavCategory[]; now: number }) {
  const tabs = useMemo<Tab[]>(() => {
    const inCategory = (id: string) => (trip: Trip) => trip.categoryId === id || trip.categories.some((category) => category.id === id);
    const featured = trips.filter((trip) => trip.isFeatured);
    return [
      ...(featured.length >= 4
        ? [{ key: "featured", label: "Онцлох", pick: () => sortTrips(featured, "soonest", now), href: `${canonicalPath("/trips")}?featured=1` }]
        : []),
      { key: "soonest", label: "Ойрын хөдлөлт", pick: (all: Trip[]) => sortTrips(all, "soonest", now), href: `${canonicalPath("/trips")}?sort=soonest` },
      { key: "newest", label: "Шинээр нэмэгдсэн", pick: (all: Trip[]) => sortTrips(all, "newest", now), href: `${canonicalPath("/trips")}?sort=newest` },
      ...categories.slice(0, 5).map((category) => ({
        key: category.id,
        label: category.name,
        pick: (all: Trip[]) => sortTrips(all.filter(inCategory(category.id)), "soonest", now),
        href: canonicalPath(`/category/${category.slug}`),
      })),
    ];
  }, [trips, categories, now]);

  const [active, setActive] = useState(tabs[0]?.key ?? "soonest");
  const tab = tabs.find((entry) => entry.key === active) ?? tabs[0];
  const shown = tab ? tab.pick(trips).slice(0, 8) : [];

  return (
    <section aria-labelledby="collection-title" className="site-container pt-20 lg:pt-28">
      <SectionHeading
        id="collection-title"
        eyebrow="Аяллын багцууд"
        title="Сонгож, харьцуулж, захиал"
        description="Аялал бүрийн хуудсанд өдөр тутмын хөтөлбөр, багтсан зүйлс, огноо бүрийн үнэ бий."
      />

      <div role="tablist" aria-label="Аяллын ангилал" className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            id={`collection-tab-${entry.key}`}
            aria-selected={entry.key === tab?.key}
            aria-controls="collection-panel"
            onClick={() => setActive(entry.key)}
            className={cn(
              "h-10 shrink-0 rounded-full border px-4 text-[13.5px] font-semibold transition-colors focus-ring",
              entry.key === tab?.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-foreground/35",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div id="collection-panel" role="tabpanel" aria-labelledby={tab ? `collection-tab-${tab.key}` : undefined} className="mt-8">
        {shown.length ? (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12">
            {shown.map((trip) => (
              <li key={trip.id}>
                <TripCard trip={trip} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">Энэ ангилалд одоогоор аялал алга.</p>
        )}
      </div>

      {tab && (
        <div className="mt-12 flex justify-center">
          <Link
            href={tab.href}
            className="inline-flex h-12 items-center gap-2 rounded-full border border-foreground/20 px-7 text-[15px] font-semibold text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background focus-ring"
          >
            {tab.key === "soonest" || tab.key === "newest" ? `Бүх ${trips.length} аяллыг үзэх` : `${tab.label} — бүгдийг үзэх`}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}
