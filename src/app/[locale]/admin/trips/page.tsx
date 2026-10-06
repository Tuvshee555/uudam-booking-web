"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Eye, EyeOff, ExternalLink, Pencil, Plus, Search, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { api, apiErrorMessage } from "@/lib/api";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { formatMnt } from "@/lib/pricing";
import type { Trip } from "@/types/trip";
import { cn } from "@/lib/utils";

export default function AdminTripsPage() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();

  const { data: trips, isPending, isError, refetch } = useQuery<Trip[]>({
    queryKey: ["admin", "trips"],
    queryFn: async () => {
      const { data } = await api.get<Trip[]>("/trips", { params: { all: "true" } });
      return data;
    },
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const visibleTrips = useMemo(() => {
    const terms = search.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return trips?.filter((trip) => {
      if (status === "published" && !trip.isPublished) return false;
      if (status === "draft" && trip.isPublished) return false;
      const categoryNames = trip.categories.length
        ? trip.categories.map((category) => category.categoryName)
        : [trip.category?.categoryName];
      const haystack = [trip.title, trip.slug, ...categoryNames, trip.hotel]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [trips, search, status]);

  const toggle = useMutation({
    mutationFn: async ({ id, ...body }: { id: string; isPublished?: boolean; isFeatured?: boolean }) => {
      const { data } = await api.put(`/trips/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "trips"] });
      toast.success("Шинэчиллээ");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Шинэчлэхэд алдаа гарлаа")),
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Аялалууд</h1>
          {trips && <span className="text-sm text-muted-foreground">Нийт {trips.length}</span>}
        </div>
        <Button asChild className="gap-1.5">
          <Link href={`/${locale}/admin/trips/new`}>
            <Plus className="h-4 w-4" />
            Шинэ аялал
          </Link>
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Нэр, ангилал, буудлаар хайх"
          className="h-10 pl-9 pr-9"
          aria-label="Аялал хайх"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Цэвэрлэх"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <select aria-label="Нийтлэлийн төлөв" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        <option value="all">Бүх аялал</option>
        <option value="published">Нийтэлсэн</option>
        <option value="draft">Ноорог</option>
      </select>
      </div>
      {(search.trim() || status !== "all") && trips && (
        <p className="mt-2 text-xs text-muted-foreground">
          {visibleTrips?.length ?? 0} / {trips.length} аялал олдлоо
        </p>
      )}

      <div className="mt-4 divide-y divide-border border-y border-border">
      {isPending ? (
        Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="my-2 h-20 animate-pulse rounded-md bg-secondary" />
        ))
      ) : isError ? (
        <div role="alert" className="flex items-center justify-center gap-3 py-12 text-sm">
          Мэдээлэл ачаалж чадсангүй.
          <Button variant="outline" size="sm" onClick={() => refetch()}>Дахин оролдох</Button>
        </div>
      ) : !trips?.length ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Аялал алга байна.
        </div>
      ) : !visibleTrips?.length ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Илэрц олдсонгүй.
        </div>
      ) : (
        visibleTrips.map((trip) => (
          <div
            key={trip.id}
            className="flex flex-wrap items-center gap-3 py-4"
          >
            <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-secondary sm:h-14 sm:w-20">
              {trip.image && (
                <Image
                  src={trip.image}
                  alt={trip.title}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/${locale}/admin/trips/${trip.id}/edit`} className="break-words text-sm font-medium hover:text-primary hover:underline">{trip.title}</Link>
                {!trip.isPublished && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    Ноорог
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{formatMnt(trip.price)}</span>
                <span>{trip.durationDays} хоног</span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {trip.departures.length} огноо
                </span>
                {(trip.categories.length ? trip.categories : trip.category ? [trip.category] : []).map((category) => (
                  <span key={category.id}>{category.categoryName}</span>
                ))}
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <button
                type="button"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate({ id: trip.id, isFeatured: !trip.isFeatured })}
                className={cn(
                  "rounded-lg border p-2 transition-colors disabled:opacity-40",
                  trip.isFeatured
                    ? "border-gold bg-gold/15 text-gold"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
                aria-label="Онцлох"
                title="Онцлох"
              >
                <Star className={cn("h-4 w-4", trip.isFeatured && "fill-current")} />
              </button>

              <button
                type="button"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate({ id: trip.id, isPublished: !trip.isPublished })}
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-primary/40 disabled:opacity-40"
                aria-label={trip.isPublished ? "Нуух" : "Нийтлэх"}
                title={trip.isPublished ? "Нуух" : "Нийтлэх"}
              >
                {trip.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>

              <Link
                href={`/${locale}/trips/${trip.slug}`}
                target="_blank"
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-primary/40"
                aria-label="Сайт дээр харах"
                title="Сайт дээр харах"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>

              <Link
                href={`/${locale}/admin/trips/${trip.id}/edit`}
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-primary/40"
                aria-label="Засах"
                title="Засах"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))
      )}
      </div>
    </>
  );
}
