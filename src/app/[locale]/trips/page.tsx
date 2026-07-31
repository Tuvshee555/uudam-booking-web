"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgePercent, Search, SlidersHorizontal, Star, X } from "lucide-react";

import { useTrips, useCategoryTree, useTags, usePriceBands } from "@/hooks/useTrips";
import TripCard from "@/components/trip/TripCard";
import { Input } from "@/components/ui/input";
import { formatMnt } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type SortKey = "recommended" | "price-asc" | "price-desc" | "duration-asc" | "soonest";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "Санал болгох" },
  { key: "price-asc", label: "Үнэ: багаас их" },
  { key: "price-desc", label: "Үнэ: ихээс бага" },
  { key: "duration-asc", label: "Богино хугацаа" },
  { key: "soonest", label: "Ойрын огноо" },
];

/** Earliest still-open departure, used by the "soonest" sort. */
function soonest(departures: { startDate: string; status: string }[]) {
  const now = Date.now();
  const times = departures
    .filter((d) => d.status !== "CANCELLED" && d.status !== "DEPARTED")
    .map((d) => new Date(d.startDate).getTime())
    .filter((time) => time >= now);

  return times.length ? Math.min(...times) : Number.POSITIVE_INFINITY;
}

export default function TripsPage() {
  return (
    <Suspense fallback={null}>
      <TripsPageInner />
    </Suspense>
  );
}

function TripsPageInner() {
  const searchParams = useSearchParams();
  // Read once at mount, not on every render: the filter is a local toggle the
  // visitor can clear, not something that should keep re-locking to the URL.
  const [featuredOnly, setFeaturedOnly] = useState(() => searchParams.get("featured") === "true");

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [bandId, setBandId] = useState<string | null>(null);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("recommended");

  const { data: categories } = useCategoryTree();
  const { data: tags } = useTags();
  const { data: priceBands } = usePriceBands();
  const { data: trips, isLoading } = useTrips();

  const activeBand = priceBands?.find((band) => band.id === bandId) ?? null;

  const visible = useMemo(() => {
    if (!trips) return [];

    const needle = search.trim().toLowerCase();

    const filtered = trips.filter((trip) => {
      if (featuredOnly && !trip.isFeatured) return false;
      if (categoryId && trip.categoryId !== categoryId) return false;
      if (onSaleOnly && !(typeof trip.discount === "number" && trip.discount > 0)) return false;
      if (tagIds.length > 0 && !trip.tags.some((tag) => tagIds.includes(tag.id))) return false;
      if (activeBand) {
        if (trip.price < activeBand.minPrice) return false;
        if (activeBand.maxPrice !== null && trip.price > activeBand.maxPrice) return false;
      }
      if (!needle) return true;

      return [trip.title, trip.summary, trip.country, trip.city, ...trip.destinations]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });

    const sorted = [...filtered];

    switch (sort) {
      case "price-asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "duration-asc":
        sorted.sort((a, b) => a.durationDays - b.durationDays);
        break;
      case "soonest":
        sorted.sort((a, b) => soonest(a.departures) - soonest(b.departures));
        break;
      default:
        // Featured first, then whatever sells most.
        sorted.sort((a, b) => {
          if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
          return b.salesCount - a.salesCount;
        });
    }

    return sorted;
  }, [trips, search, categoryId, sort, featuredOnly, tagIds, activeBand, onSaleOnly]);

  return (
    <div className="uudam-container py-8">
      <header>
        <h1 className="text-2xl font-bold md:text-3xl">Бүх аялал</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Чиглэл, үнэ, хугацаагаар шүүж өөрт тохирох аялалаа олоорой.
        </p>
      </header>

      {featuredOnly && (
        <button
          type="button"
          onClick={() => setFeaturedOnly(false)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gold bg-gold/15 px-3 py-1.5 text-xs font-semibold text-navy-deep dark:text-gold"
        >
          <Star className="h-3.5 w-3.5 fill-current" />
          Зөвхөн онцлох аялал
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Улс, хот эсвэл аяллын нэрээр хайх"
            className="pl-9"
          />
        </div>

        <div className="relative">
          <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm sm:w-56"
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {categories && categories.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              categoryId === null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:border-primary/40",
            )}
          >
            Бүгд
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryId(category.id)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                categoryId === category.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/40",
              )}
            >
              {category.categoryName}
            </button>
          ))}
        </div>
      )}

      {((priceBands && priceBands.length > 0) || (tags && tags.length > 0)) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnSaleOnly((v) => !v)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              onSaleOnly
                ? "border-destructive bg-destructive text-destructive-foreground"
                : "border-border hover:border-destructive/40",
            )}
          >
            <BadgePercent className="h-3.5 w-3.5" />
            Хямдралтай
          </button>

          {priceBands?.map((band) => (
            <button
              key={band.id}
              type="button"
              onClick={() => setBandId((current) => (current === band.id ? null : band.id))}
              title={`${formatMnt(band.minPrice)} – ${band.maxPrice !== null ? formatMnt(band.maxPrice) : "∞"}`}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                bandId === band.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/40",
              )}
            >
              {band.name}
            </button>
          ))}

          {tags && tags.length > 0 && (
            <>
              <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
              {tags.map((tag) => {
                const active = tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      setTagIds((current) =>
                        active ? current.filter((id) => id !== tag.id) : [...current, tag.id],
                      )
                    }
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-[380px] animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm font-medium">Тохирох аялал олдсонгүй</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Хайлтаа өөрчилж эсвэл ангиллын шүүлтүүрээ цэвэрлэж үзнэ үү.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{visible.length} аялал олдлоо</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {visible.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
