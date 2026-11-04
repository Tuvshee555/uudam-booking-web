"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";

import { useTrips } from "@/hooks/useTrips";
import TripCard from "@/components/trip/TripCard";
import FilterPanel from "@/components/catalog/FilterPanel";
import SortMenu from "@/components/catalog/SortMenu";
import { SunMark } from "@/components/site/SunMark";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  activeFilterCount,
  catalogFacets,
  emptyFilters,
  filtersFromParams,
  filtersToQuery,
  sortTrips,
  SORTS,
  tripMatches,
  type CatalogFilters,
  type PriceRange,
  type SortKey,
} from "@/lib/catalogFilters";
import { track } from "@/lib/analytics";
import { monthChipLabel } from "@/lib/calendar";
import { canonicalPath } from "@/lib/locales";
import { formatCategoryName } from "@/lib/tripDisplay";
import type { Trip } from "@/types/trip";
import { cn } from "@/lib/utils";

const PAGE = 12;

type Chip = { key: string; label: string; remove: (filters: CatalogFilters) => CatalogFilters };

export default function CatalogBrowser({
  initialTrips,
  prices,
  now,
  currentYear,
  lockedCategory,
}: {
  initialTrips: Trip[];
  prices: PriceRange[];
  now: number;
  currentYear: number;
  /**
   * A category page: always filtered to this category, with its facet hidden.
   * Its page sends only this category's trips, so they are cached under the
   * category's own query: under the shared one, this short list would stand
   * in for the whole catalogue on the next page.
   */
  lockedCategory?: { id: string; name: string };
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? canonicalPath("/trips");
  const { data, isError, refetch, isFetching } = useTrips(lockedCategory ? { category: lockedCategory.id } : undefined, initialTrips);
  const trips = useMemo(() => data ?? [], [data]);

  // The URL is the source of truth: filters are shareable in Messenger, survive
  // a reload and the back button. Updates go through history.replaceState,
  // which Next folds into useSearchParams without a server round trip.
  const urlFilters = useMemo(() => filtersFromParams(searchParams, prices), [searchParams, prices]);
  const filters = useMemo<CatalogFilters>(
    () => (lockedCategory ? { ...urlFilters, categories: [lockedCategory.id] } : urlFilters),
    [urlFilters, lockedCategory],
  );

  const apply = (next: CatalogFilters) => {
    const query = filtersToQuery(lockedCategory ? { ...next, categories: [] } : next);
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  };

  // What is typed, until the debounced write lands in the URL; a URL change
  // from elsewhere (back button, a chip) replaces it.
  const [draft, setDraft] = useState({ base: urlFilters.q, value: urlFilters.q });
  const query = draft.base === urlFilters.q ? draft.value : urlFilters.q;
  const setQuery = (value: string) => setDraft({ base: urlFilters.q, value });
  const queryTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(queryTimer.current), []);
  const onQuery = (value: string) => {
    setQuery(value);
    window.clearTimeout(queryTimer.current);
    queryTimer.current = window.setTimeout(() => apply({ ...filters, q: value }), 250);
  };
  const commitQuery = () => {
    if (query.trim().length >= 2) track("search_submit", { properties: { query: query.trim().slice(0, 60), from: "catalog" } });
  };

  const onFilter = (next: CatalogFilters, facet: string, value: string) => {
    apply(next);
    track("filter_change", { properties: { facet, value } });
  };

  const labels = useMemo(() => {
    const categories = new Map<string, string>();
    const tags = new Map<string, string>();
    for (const trip of trips) {
      for (const category of [trip.category, ...trip.categories]) if (category) categories.set(category.id, formatCategoryName(category.categoryName));
      for (const tag of trip.tags) tags.set(tag.id, tag.name);
    }
    return { categories, tags, month: (key: string) => monthChipLabel(key, currentYear) };
  }, [trips, currentYear]);

  const facets = useMemo(() => catalogFacets(trips, filters, now, labels, prices), [trips, filters, now, labels, prices]);
  const results = useMemo(
    () => sortTrips(trips.filter((trip) => tripMatches(trip, filters, now, undefined, prices)), filters.sort, now),
    [trips, filters, now, prices],
  );

  // "Show more" resets whenever the filters change.
  const filterKey = filtersToQuery(filters);
  const [paging, setPaging] = useState({ key: filterKey, limit: PAGE });
  const limit = paging.key === filterKey ? paging.limit : PAGE;
  const setLimit = (next: (value: number) => number) => setPaging({ key: filterKey, limit: next(limit) });

  const [sheetOpen, setSheetOpen] = useState(false);
  const count = activeFilterCount(lockedCategory ? { ...filters, categories: [] } : filters);

  const chips: Chip[] = [
    ...(filters.q.trim() ? [{ key: "q", label: `«${filters.q.trim()}»`, remove: (f: CatalogFilters) => ({ ...f, q: "" }) }] : []),
    ...filters.destinations.map((key) => ({ key: `d-${key}`, label: facets.destinations.find((option) => option.key === key)?.label ?? key, remove: (f: CatalogFilters) => ({ ...f, destinations: f.destinations.filter((item) => item !== key) }) })),
    ...filters.months.map((key) => ({ key: `m-${key}`, label: labels.month(key), remove: (f: CatalogFilters) => ({ ...f, months: f.months.filter((item) => item !== key) }) })),
    ...(lockedCategory ? [] : filters.categories.map((key) => ({ key: `c-${key}`, label: labels.categories.get(key) ?? "Ангилал", remove: (f: CatalogFilters) => ({ ...f, categories: f.categories.filter((item) => item !== key) }) }))),
    ...(filters.price ? [{ key: "price", label: prices.find((range) => range.key === filters.price)?.label ?? "Үнэ", remove: (f: CatalogFilters) => ({ ...f, price: null }) }] : []),
    ...filters.durations.map((key) => ({ key: `u-${key}`, label: facets.durations.find((option) => option.key === key)?.label ?? key, remove: (f: CatalogFilters) => ({ ...f, durations: f.durations.filter((item) => item !== key) }) })),
    ...filters.tags.map((key) => ({ key: `t-${key}`, label: labels.tags.get(key) ?? "Сэдэв", remove: (f: CatalogFilters) => ({ ...f, tags: f.tags.filter((item) => item !== key) }) })),
    ...(filters.available ? [{ key: "available", label: "Захиалга авч буй", remove: (f: CatalogFilters) => ({ ...f, available: false }) }] : []),
    ...(filters.sale ? [{ key: "sale", label: "Хямдралтай", remove: (f: CatalogFilters) => ({ ...f, sale: false }) }] : []),
    ...(filters.featured ? [{ key: "featured", label: "Онцлох", remove: (f: CatalogFilters) => ({ ...f, featured: false }) }] : []),
  ];

  const clearAll = () => {
    setQuery("");
    apply({ ...emptyFilters(), sort: filters.sort });
  };

  const panel = (
    <FilterPanel facets={facets} filters={filters} onChange={onFilter} hideCategories={Boolean(lockedCategory)} />
  );

  return (
    <div className="site-container pb-20 pt-8 lg:pt-10">
      <div className="relative">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onBlur={commitQuery}
          onKeyDown={(event) => event.key === "Enter" && commitQuery()}
          placeholder="Улс, хот эсвэл аяллын нэрээр хайх — Хайнан, Токио, Бали…"
          aria-label="Аялал хайх"
          enterKeyHint="search"
          className="h-14 w-full rounded-full border border-border bg-card pl-14 pr-5 text-[16px] text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
        />
      </div>

      <div className="mt-8 lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block" aria-label="Шүүлтүүр">
          <div className="sticky top-[100px] max-h-[calc(100vh-120px)] overflow-y-auto pb-6 pr-3">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-[15px] font-semibold text-foreground">Шүүлтүүр</p>
              {count > 0 && (
                <button type="button" onClick={clearAll} className="rounded-sm text-[13px] font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground focus-ring">
                  Цэвэрлэх
                </button>
              )}
            </div>
            {panel}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="sticky top-16 z-20 -mx-4 flex items-center justify-between gap-3 border-b max-[359px]:flex-wrap max-[359px]:gap-y-2 border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:backdrop-blur-none">
            <p className="text-[14px] text-muted-foreground" aria-live="polite">
              <span className="font-semibold text-foreground">{results.length}</span> аялал
              {isFetching && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" aria-label="Шинэчилж байна" />}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-[13px] font-semibold text-foreground focus-ring lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Шүүлтүүр
                {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{count}</span>}
              </button>
              <SortMenu
                value={filters.sort}
                options={SORTS}
                onChange={(sort: SortKey) => onFilter({ ...filters, sort }, "sort", sort)}
              />
            </div>
          </div>

          {chips.length > 0 && (
            <ul className="mt-4 flex flex-wrap items-center gap-2" aria-label="Идэвхтэй шүүлтүүр">
              {chips.map((chip) => (
                <li key={chip.key}>
                  <button
                    type="button"
                    onClick={() => {
                      if (chip.key === "q") setQuery("");
                      apply(chip.remove(filters));
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary pl-3 pr-2 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary/70 focus-ring"
                    aria-label={`${chip.label} шүүлтүүрийг хасах`}
                  >
                    {chip.label}
                    <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={clearAll} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground focus-ring">
                  Бүгдийг цэвэрлэх
                </button>
              </li>
            </ul>
          )}

          <div className="mt-6">
            {isError && trips.length === 0 ? (
              <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
                <p className="display-3 text-foreground">Аяллуудыг ачаалж чадсангүй</p>
                <p className="mt-2 text-sm text-muted-foreground">Интернэт холболтоо шалгаад дахин оролдоно уу.</p>
                <button type="button" onClick={() => refetch()} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground focus-ring">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" /> Дахин ачаалах
                </button>
              </div>
            ) : results.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
                <SunMark className="mx-auto h-12 w-12 text-foreground" />
                <p className="display-3 mt-5 text-foreground">Тохирох аялал олдсонгүй</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Шүүлтүүрээ багасгаж үзнэ үү. Хүссэн аялал тань энд байхгүй бол бид таны огноо, чиглэлээр зохион байгуулж өгнө.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {count > 0 && (
                    <button type="button" onClick={clearAll} className="inline-flex h-11 items-center rounded-full border border-border bg-card px-6 text-sm font-semibold text-foreground focus-ring">
                      Шүүлтүүрийг цэвэрлэх
                    </button>
                  )}
                  <Link href={canonicalPath("/custom-trip")} className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground focus-ring">
                    Захиалгат аялал хүсэх
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <h2 className="sr-only">Аяллын жагсаалт</h2>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-12">
                  {results.slice(0, limit).map((trip, index) => (
                    <li key={trip.id}>
                      <TripCard trip={trip} eager={index < 3} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 45vw, 30vw" />
                    </li>
                  ))}
                </ul>
                {results.length > limit && (
                  <div className="mt-12 flex flex-col items-center gap-3">
                    <p className="text-[13px] text-muted-foreground">{results.length} аяллаас {limit}-ийг харуулж байна</p>
                    <button
                      type="button"
                      onClick={() => setLimit((value) => value + PAGE)}
                      className="inline-flex h-12 items-center rounded-full border border-foreground/20 px-7 text-[15px] font-semibold text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background focus-ring"
                    >
                      Цааш үзэх ({Math.min(PAGE, results.length - limit)})
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="site-theme flex max-h-[88dvh] flex-col gap-0 rounded-t-2xl p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 pr-14">
            <SheetTitle className="text-[17px] font-semibold text-foreground">Шүүлтүүр</SheetTitle>
            <SheetDescription className="sr-only">Аяллыг чиглэл, огноо, үнээр шүүх</SheetDescription>
            {count > 0 && (
              <button type="button" onClick={clearAll} className="text-[13px] font-semibold text-muted-foreground underline underline-offset-4 focus-ring">
                Цэвэрлэх
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{panel}</div>
          <div className="border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className={cn("flex h-12 w-full items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground focus-ring")}
            >
              {results.length} аялал харах
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
