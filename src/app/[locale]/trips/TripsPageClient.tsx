"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BadgePercent, CalendarDays, MapPin, Search, SlidersHorizontal, Star, X } from "lucide-react";

import { useTrips, useCategoryTree, useTags, usePriceBands } from "@/hooks/useTrips";
import TripCard from "@/components/trip/TripCard";
import { Input } from "@/components/ui/input";
import { formatMnt } from "@/lib/pricing";
import { soonestDepartureTime, upcomingDepartures } from "@/lib/departures";
import type { Trip } from "@/types/trip";
import { cn } from "@/lib/utils";

type SortKey = "recommended" | "price-asc" | "price-desc" | "duration-asc" | "soonest";

/** Duration buckets. Ranges are inclusive; `max: null` means "and longer". */
const DURATIONS: { key: string; label: string; min: number; max: number | null }[] = [
  { key: "1-4", label: "1-4 хоног", min: 1, max: 4 },
  { key: "5-7", label: "5-7 хоног", min: 5, max: 7 },
  { key: "8+", label: "8+ хоног", min: 8, max: null },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "Санал болгох" },
  { key: "price-asc", label: "Үнэ: багаас их" },
  { key: "price-desc", label: "Үнэ: ихээс бага" },
  { key: "duration-asc", label: "Богино хугацаа" },
  { key: "soonest", label: "Ойрын огноо" },
];


export default function TripsPageClient({ initialTrips }: { initialTrips?: Trip[] }) {
  return (
    <Suspense fallback={null}>
      <TripsPageInner initialTrips={initialTrips} />
    </Suspense>
  );
}

function TripsPageInner({ initialTrips }: { initialTrips?: Trip[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Every filter is seeded from the URL, so a filtered catalogue can be shared
  // in Messenger — the agency's actual sales channel — bookmarked, and survive
  // a back button. It used to live purely in component state, which made every
  // filtered view unlinkable.
  const [featuredOnly, setFeaturedOnly] = useState(() => searchParams.get("featured") === "true");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(() => searchParams.get("category"));
  const [country, setCountry] = useState<string | null>(() => searchParams.get("country"));
  const [month, setMonth] = useState<string | null>(() => searchParams.get("month"));
  const [tagIds, setTagIds] = useState<string[]>(() => {
    const raw = searchParams.get("tags");
    return raw ? raw.split(",").filter(Boolean) : [];
  });
  const [bandId, setBandId] = useState<string | null>(() => searchParams.get("band"));
  const [durationKey, setDurationKey] = useState<string | null>(() => searchParams.get("duration"));
  const [onSaleOnly, setOnSaleOnly] = useState(() => searchParams.get("sale") === "true");
  const [sort, setSort] = useState<SortKey>(() => {
    const raw = searchParams.get("sort");
    return SORTS.some((option) => option.key === raw) ? (raw as SortKey) : "recommended";
  });

  // Frozen at mount. Reading the clock during render makes the component
  // impure, and a departure shouldn't drop out of the results mid-scroll.
  const [now] = useState(() => Date.now());

  const { data: categories } = useCategoryTree();
  const { data: tags } = useTags();
  const { data: priceBands } = usePriceBands();
  const { data: trips, isLoading } = useTrips(undefined, initialTrips);

  const activeBand = priceBands?.find((band) => band.id === bandId) ?? null;
  const activeDuration = DURATIONS.find((entry) => entry.key === durationKey) ?? null;

  // Mirror state back into the URL without adding a history entry per keystroke.
  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (categoryId) params.set("category", categoryId);
    if (country) params.set("country", country);
    if (month) params.set("month", month);
    if (tagIds.length) params.set("tags", tagIds.join(","));
    if (bandId) params.set("band", bandId);
    if (durationKey) params.set("duration", durationKey);
    if (onSaleOnly) params.set("sale", "true");
    if (featuredOnly) params.set("featured", "true");
    if (sort !== "recommended") params.set("sort", sort);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [
    search,
    categoryId,
    country,
    month,
    tagIds,
    bandId,
    durationKey,
    onSaleOnly,
    featuredOnly,
    sort,
    pathname,
    router,
  ]);

  /** Countries present in the catalogue, for the destination filter. */
  const countries = useMemo(() => {
    if (!trips) return [];
    return Array.from(
      new Set(trips.map((trip) => trip.country).filter((value): value is string => Boolean(value))),
    ).sort((a, b) => a.localeCompare(b, "mn"));
  }, [trips]);

  /**
   * Months that actually have an upcoming departure. Built from the data rather
   * than a fixed twelve-month list so the filter never offers an empty month.
   */
  const months = useMemo(() => {
    if (!trips) return [];
    const keys = new Set<string>();

    for (const trip of trips) {
      for (const departure of upcomingDepartures(trip, now)) {
        const date = new Date(departure.startDate);
        keys.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
      }
    }

    return Array.from(keys)
      .sort()
      .map((key) => {
        const [year, monthIndex] = key.split("-");
        const label = new Date(Number(year), Number(monthIndex) - 1, 1).toLocaleDateString("mn-MN", {
          year: "numeric",
          month: "long",
        });
        return { key, label };
      });
  }, [trips, now]);

  const visible = useMemo(() => {
    if (!trips) return [];

    const needle = search.trim().toLowerCase();

    const filtered = trips.filter((trip) => {
      if (featuredOnly && !trip.isFeatured) return false;
      if (categoryId && trip.categoryId !== categoryId) return false;
      if (country && trip.country !== country) return false;
      if (onSaleOnly && !(typeof trip.discount === "number" && trip.discount > 0)) return false;
      if (tagIds.length > 0 && !trip.tags.some((tag) => tagIds.includes(tag.id))) return false;
      if (month) {
        const departsThatMonth = upcomingDepartures(trip, now).some((departure) => {
          const date = new Date(departure.startDate);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          return key === month;
        });
        if (!departsThatMonth) return false;
      }
      if (activeDuration) {
        if (trip.durationDays < activeDuration.min) return false;
        if (activeDuration.max !== null && trip.durationDays > activeDuration.max) return false;
      }
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
        sorted.sort((a, b) => soonestDepartureTime(a, now) - soonestDepartureTime(b, now));
        break;
      default:
        // Featured first, then whatever sells most.
        sorted.sort((a, b) => {
          if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
          return b.salesCount - a.salesCount;
        });
    }

    return sorted;
  }, [
    trips,
    search,
    categoryId,
    country,
    month,
    sort,
    featuredOnly,
    tagIds,
    activeBand,
    activeDuration,
    onSaleOnly,
    now,
  ]);

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

        {countries.length > 0 && (
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={country ?? ""}
              onChange={(event) => setCountry(event.target.value || null)}
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm sm:w-44"
            >
              <option value="">Бүх чиглэл</option>
              {countries.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        {months.length > 0 && (
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={month ?? ""}
              onChange={(event) => setMonth(event.target.value || null)}
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm sm:w-44"
            >
              <option value="">Бүх сар</option>
              {months.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

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

          {DURATIONS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() =>
                setDurationKey((current) => (current === entry.key ? null : entry.key))
              }
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                durationKey === entry.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/40",
              )}
            >
              {entry.label}
            </button>
          ))}

          {priceBands && priceBands.length > 0 && (
            <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
          )}

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
