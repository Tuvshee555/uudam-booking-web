"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Eye, EyeOff, ImageOff, Loader2, Map as MapIcon, Pencil, Plus, Star, StarOff, X } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import {
  EmptyState,
  ErrorState,
  FilterChips,
  LoadingRows,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  SelectFilter,
  StatusBadge,
  Switch,
  useConfirm,
  useDebouncedValue,
} from "@/components/admin/ui";
import { useScopedSelection, useUrlFilters } from "@/components/admin/useUrlFilters";
import { LIVE_QUERY } from "@/hooks/useAdminSummary";
import { useCategoryTree } from "@/hooks/useTrips";
import { useTripHealth } from "@/hooks/useTripHealth";
import { Button } from "@/components/ui/button";
import { departureDateKey } from "@/lib/departureDate";
import { nextBookableDeparture, startingPrice, upcomingDepartures } from "@/lib/departures";
import { dateFromKey, formatDate, formatMoney, formatNumber } from "@/lib/adminFormat";
import type { CategoryNode, Trip } from "@/types/trip";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type StatusFilter = "all" | "published" | "draft" | "featured" | "issues";
type SortKey = "newest" | "title" | "price-asc" | "price-desc" | "next";

function flattenCategories(nodes: CategoryNode[], depth = 0): { value: string; label: string }[] {
  return nodes.flatMap((node) => [
    { value: node.id, label: `${"— ".repeat(depth)}${node.categoryName}` },
    ...flattenCategories(node.children, depth + 1),
  ]);
}

function tripCategories(trip: Trip) {
  return trip.categories.length ? trip.categories : trip.category ? [trip.category] : [];
}

/** Everything the list shows about a trip, worked out once per row. */
function describe(trip: Trip, now: number) {
  const upcoming = upcomingDepartures(trip, now);
  const bookable = nextBookableDeparture(trip, now);
  const next = bookable ?? upcoming[0] ?? null;
  const price = startingPrice(trip, now);
  return {
    upcomingCount: upcoming.length,
    // Dates exist but every one is sold out or paused — customers can't book any of them.
    allClosed: upcoming.length > 0 && !bookable,
    next,
    nextLabel: next ? formatDate(dateFromKey(departureDateKey(next.startDate))) : null,
    nextTime: next ? new Date(next.startDate).getTime() : Number.POSITIVE_INFINITY,
    price: price > 0 ? price : null,
  };
}

export default function TripsClient() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const admin = `/${locale}/admin`;

  const trips = useQuery<Trip[]>({
    queryKey: ["admin", "trips"],
    queryFn: async () => (await api.get<Trip[]>("/trips", { params: { all: "true" } })).data,
    ...LIVE_QUERY,
  });
  const { data: health } = useTripHealth();
  const { data: categoryTree } = useCategoryTree(undefined, { admin: true });

  const [filters, setFilters] = useUrlFilters({ status: "all", q: "", category: "all", sort: "newest", page: "1" });
  const page = Math.max(1, Number(filters.page) || 1);
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const search = useDebouncedValue(searchDraft.trim(), 250);
  useEffect(() => {
    if (search !== filters.q) setFilters({ q: search, page: null });
    // Only a settled search should move the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Captured once per load so the list doesn't reshuffle while someone works in it.
  const [now] = useState(() => Date.now());

  const issuesByTrip = useMemo(() => {
    const map = new Map<string, { errors: number; warnings: number }>();
    for (const issue of health?.issues ?? []) {
      const entry = map.get(issue.tripId) ?? { errors: 0, warnings: 0 };
      if (issue.severity === "error") entry.errors += 1;
      else entry.warnings += 1;
      map.set(issue.tripId, entry);
    }
    return map;
  }, [health]);

  const rows = useMemo(() => {
    const all = (trips.data ?? []).map((trip) => ({ trip, info: describe(trip, now) }));
    const terms = filters.q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const filtered = all.filter(({ trip }) => {
      const status = filters.status as StatusFilter;
      if (status === "published" && !trip.isPublished) return false;
      if (status === "draft" && trip.isPublished) return false;
      if (status === "featured" && !trip.isFeatured) return false;
      if (status === "issues" && !issuesByTrip.get(trip.id)?.errors) return false;
      if (filters.category !== "all" && !tripCategories(trip).some((category) => category.id === filters.category)) return false;
      if (!terms.length) return true;
      const haystack = [trip.title, trip.slug, trip.country, trip.city, trip.hotel, ...trip.destinations, ...tripCategories(trip).map((c) => c.categoryName)]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    });

    const sort = filters.sort as SortKey;
    if (sort === "title") filtered.sort((a, b) => a.trip.title.localeCompare(b.trip.title, "mn"));
    if (sort === "price-asc") filtered.sort((a, b) => (a.info.price ?? Infinity) - (b.info.price ?? Infinity));
    if (sort === "price-desc") filtered.sort((a, b) => (b.info.price ?? -1) - (a.info.price ?? -1));
    if (sort === "next") filtered.sort((a, b) => a.info.nextTime - b.info.nextTime);
    return filtered;
  }, [trips.data, filters.q, filters.status, filters.category, filters.sort, issuesByTrip, now]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const [selected, setSelected] = useScopedSelection(`${filters.status}|${filters.q}|${filters.category}|${page}`);

  const counts = useMemo(() => {
    const list = trips.data ?? [];
    return {
      all: list.length,
      published: list.filter((trip) => trip.isPublished).length,
      draft: list.filter((trip) => !trip.isPublished).length,
      featured: list.filter((trip) => trip.isFeatured).length,
      issues: list.filter((trip) => issuesByTrip.get(trip.id)?.errors).length,
    };
  }, [trips.data, issuesByTrip]);

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { isPublished?: boolean; isFeatured?: boolean }; title: string; undo?: boolean }) =>
      (await api.put<Trip>(`/trips/${id}`, patch)).data,
    onSuccess: (_, { id, patch, title, undo }) => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip", id] });
      const message =
        patch.isPublished !== undefined
          ? patch.isPublished
            ? `«${title}» сайтад харагдах боллоо`
            : `«${title}» сайтаас нуугдлаа`
          : patch.isFeatured
            ? `«${title}» онцлох аялал боллоо`
            : `«${title}» онцлохоос хасагдлаа`;
      const reverse = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, !value]));
      toast.success(message, {
        duration: 8000,
        action: undo ? undefined : { label: "Буцаах", onClick: () => update.mutate({ id, patch: reverse, title, undo: true }) },
      });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  const bulk = useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: { isPublished?: boolean; isFeatured?: boolean } }) => {
      let ok = 0;
      let failed = 0;
      // A few at a time: every save also syncs the trip to the chatbot.
      for (let index = 0; index < ids.length; index += 3) {
        const results = await Promise.allSettled(ids.slice(index, index + 3).map((id) => api.put(`/trips/${id}`, patch)));
        ok += results.filter((result) => result.status === "fulfilled").length;
        failed += results.filter((result) => result.status === "rejected").length;
      }
      return { ok, failed };
    },
    onSuccess: ({ ok, failed }) => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      setSelected(new Set());
      if (ok) toast.success(`${ok} аяллыг шинэчиллээ`);
      if (failed) toast.error(`${failed} аяллыг шинэчилж чадсангүй. Дахин оролдоно уу.`);
    },
  });

  async function setPublished(trip: Trip, isPublished: boolean) {
    if (!isPublished) {
      const ok = await confirm({
        title: "Энэ аяллыг сайтаас нуух уу?",
        description: `«${trip.title}» үйлчлүүлэгчдэд харагдахгүй, шинэ хүсэлт, захиалга авахгүй болно. Хүссэн үедээ буцааж нийтэлж болно.`,
        confirmLabel: "Нуух",
      });
      if (!ok) return;
    }
    update.mutate({ id: trip.id, patch: { isPublished }, title: trip.title });
  }

  async function runBulk(patch: { isPublished?: boolean; isFeatured?: boolean }, label: string) {
    const ids = [...selected];
    if (!ids.length) return;
    const ok = await confirm({
      title: `${ids.length} аяллыг ${label} уу?`,
      description:
        patch.isPublished === false
          ? "Сонгосон аяллууд үйлчлүүлэгчдэд харагдахгүй, шинэ хүсэлт авахгүй болно."
          : patch.isPublished
            ? "Үнэ, зураг дутуу аялал сайтад гарвал «Үнэ лавлах» гэж харагдана. Нийтлэхийн өмнө шалгаарай."
            : "Сонгосон аяллын онцлох тохиргоо өөрчлөгдөнө.",
      confirmLabel: "Тийм",
      tone: patch.isPublished === false ? "danger" : "default",
    });
    if (ok) bulk.mutate({ ids, patch });
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const allSelected = pageRows.length > 0 && pageRows.every(({ trip }) => selected.has(trip.id));

  const statusOptions = [
    { value: "all", label: "Бүгд", count: counts.all },
    { value: "published", label: "Сайтад харагдаж буй", count: counts.published },
    { value: "draft", label: "Ноорог", count: counts.draft },
    { value: "featured", label: "Онцлох", count: counts.featured },
    ...(health ? [{ value: "issues", label: "Алдаатай", count: counts.issues }] : []),
  ];

  const filtersActive = filters.status !== "all" || filters.category !== "all" || Boolean(filters.q);

  return (
    <>
      <PageHeader
        title="Аялалууд"
        description="Сайт дээрх бүх аялал. «Сайтад харагдана» унтраалгаар нийтлэх эсвэл нуух, «Онцлох» унтраалгаар нүүр хуудсанд гаргана. Үнэ, огноо, хөтөлбөрийг «Засах» дотроос өөрчилнө."
        actions={
          <Button asChild>
            <Link href={`${admin}/trips/new`}>
              <Plus />
              Шинэ аялал нэмэх
            </Link>
          </Button>
        }
      />

      <div className="space-y-3">
        <FilterChips label="Аяллыг шүүх" options={statusOptions} value={filters.status} onChange={(status) => setFilters({ status, page: null })} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput className="flex-1" value={searchDraft} onChange={setSearchDraft} placeholder="Аяллын нэр, улс, хот, буудлаар хайх" />
          <SelectFilter
            label="Ангилал"
            value={filters.category}
            onChange={(category) => setFilters({ category, page: null })}
            options={[{ value: "all", label: "Бүх ангилал" }, ...flattenCategories(categoryTree ?? [])]}
          />
          <SelectFilter
            label="Эрэмбэ"
            value={filters.sort}
            onChange={(sort) => setFilters({ sort })}
            options={[
              { value: "newest", label: "Шинээр нэмсэн нь эхэндээ" },
              { value: "next", label: "Ойрын гаралттай нь эхэндээ" },
              { value: "title", label: "Нэрээр (А–Я)" },
              { value: "price-asc", label: "Үнэ: багаас их" },
              { value: "price-desc", label: "Үнэ: ихээс бага" },
            ]}
          />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-14 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-card px-4 py-3 shadow-md lg:top-2">
          <span className="mr-1 text-sm font-semibold">{selected.size} аялал сонгосон</span>
          <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => runBulk({ isPublished: true }, "сайтад нийтлэх")}>
            <Eye />
            Нийтлэх
          </Button>
          <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => runBulk({ isPublished: false }, "сайтаас нуух")}>
            <EyeOff />
            Нуух
          </Button>
          <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => runBulk({ isFeatured: true }, "онцлох болгох")}>
            <Star />
            Онцлох болгох
          </Button>
          <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => runBulk({ isFeatured: false }, "онцлохоос хасах")}>
            <StarOff />
            Онцлохоос хасах
          </Button>
          {bulk.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            <X />
            Сонголтыг цуцлах
          </Button>
        </div>
      )}

      <Panel className="mt-4" bodyClassName="p-0 sm:p-0">
        {trips.isPending ? (
          <LoadingRows rows={6} className="p-4" rowClassName="h-16" />
        ) : trips.isError ? (
          <ErrorState error={trips.error} onRetry={() => trips.refetch()} />
        ) : !trips.data.length ? (
          <EmptyState
            icon={MapIcon}
            title="Аялал хараахан нэмээгүй байна"
            description="Эхний аяллаа нэмээд үнэ, огноо, зургаа оруулбал сайтад харагдана."
            action={
              <Button asChild>
                <Link href={`${admin}/trips/new`}>
                  <Plus />
                  Шинэ аялал нэмэх
                </Link>
              </Button>
            }
          />
        ) : !rows.length ? (
          <EmptyState
            icon={MapIcon}
            title="Тохирох аялал олдсонгүй"
            description="Өөр үгээр хайх эсвэл шүүлтүүрээ арилгаад үзнэ үү."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearchDraft("");
                  setFilters({ status: null, q: null, category: null, page: null });
                }}
              >
                Шүүлтүүрийг арилгах
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-sm text-muted-foreground">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(pageRows.map(({ trip }) => trip.id)))}
                  className="h-4 w-4 accent-primary"
                />
                Бүгдийг сонгох
              </label>
              <span className="tabular-nums">
                {filtersActive ? `${formatNumber(rows.length)} / ${formatNumber(counts.all)} аялал` : `${formatNumber(counts.all)} аялал`}
              </span>
            </div>

            <ul className="divide-y divide-border">
              {pageRows.map(({ trip, info }) => {
                const issues = issuesByTrip.get(trip.id);
                const categories = tripCategories(trip);
                const busy = update.isPending && update.variables?.id === trip.id;
                const editHref = `${admin}/trips/${trip.id}/edit`;
                return (
                  <li key={trip.id} className={cn("px-4 py-3.5", selected.has(trip.id) && "bg-primary/5")}>
                    <div className="flex gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(trip.id)}
                        onChange={() => toggleOne(trip.id)}
                        aria-label={`Сонгох: ${trip.title}`}
                        className="mt-1 h-4 w-4 shrink-0 accent-primary"
                      />
                      <Link href={editHref} tabIndex={-1} aria-hidden="true" className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                        {trip.image ? (
                          <Image src={trip.image} alt="" fill sizes="80px" className="object-cover" />
                        ) : (
                          <ImageOff className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />
                        )}
                      </Link>

                      <div className="grid min-w-0 flex-1 gap-x-6 gap-y-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_auto] xl:items-center">
                        <div className="min-w-0 md:col-span-2 xl:col-span-1">
                          <Link href={editHref} className="line-clamp-2 text-sm font-semibold hover:text-primary hover:underline">
                            {trip.title}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {[
                              categories.map((category) => category.categoryName).join(", ") || "Ангилалгүй",
                              `${trip.durationDays} өдөр${trip.durationNights ? ` ${trip.durationNights} шөнө` : ""}`,
                            ].join(" · ")}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <StatusBadge tone={trip.isPublished ? "success" : "neutral"}>
                              {trip.isPublished ? "Сайтад харагдана" : "Ноорог"}
                            </StatusBadge>
                            {trip.isFeatured && <StatusBadge tone="brand">Онцлох</StatusBadge>}
                            {issues?.errors ? (
                              <Link href={`${admin}/health`}>
                                <StatusBadge tone="danger">{issues.errors} алдаа</StatusBadge>
                              </Link>
                            ) : null}
                            {trip.isPublished && (
                              <a
                                href={`/${locale}/trips/${trip.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              >
                                Сайт дээр харах
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground xl:hidden">Эхлэх үнэ</p>
                          {info.price ? (
                            <p className="font-semibold tabular-nums">{formatMoney(info.price)}</p>
                          ) : (
                            <p className="inline-flex items-center gap-1 font-medium text-amber-800 dark:text-amber-300">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Үнэ оруулаагүй
                            </p>
                          )}
                        </div>

                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground xl:hidden">Дараагийн гаралт</p>
                          {info.allClosed ? (
                            <>
                              <p className="font-medium text-amber-800 dark:text-amber-300">Бүх огноо хаалттай</p>
                              <p className="text-xs text-muted-foreground">{info.upcomingCount} огноо дүүрсэн эсвэл түр зогссон</p>
                            </>
                          ) : info.nextLabel ? (
                            <>
                              <p className="font-medium">{info.nextLabel}</p>
                              <p className="text-xs text-muted-foreground">Нийт {info.upcomingCount} ирэх огноо</p>
                            </>
                          ) : (
                            <p className="font-medium text-amber-800 dark:text-amber-300">Ирэх огноо алга</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 md:col-span-2 xl:col-span-1 xl:border-0 xl:pt-0">
                          <label className="flex items-center gap-2 text-sm">
                            <Switch
                              checked={trip.isPublished}
                              disabled={busy}
                              onCheckedChange={(next) => setPublished(trip, next)}
                              label={`Сайтад харагдана: ${trip.title}`}
                            />
                            <span>Сайтад</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Switch
                              checked={trip.isFeatured}
                              disabled={busy}
                              onCheckedChange={(isFeatured) => update.mutate({ id: trip.id, patch: { isFeatured }, title: trip.title })}
                              label={`Онцлох: ${trip.title}`}
                            />
                            <span>Онцлох</span>
                          </label>
                          <Button asChild size="sm" variant="outline" className="ml-auto xl:ml-0">
                            <Link href={editHref}>
                              <Pencil />
                              Засах
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={rows.length}
              onPageChange={(next) => {
                setFilters({ page: String(next) });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </>
        )}
      </Panel>
    </>
  );
}
