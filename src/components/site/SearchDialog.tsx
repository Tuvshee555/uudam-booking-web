"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, CalendarDays, Loader2, MapPin, Search, X } from "lucide-react";

import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { canonicalPath } from "@/lib/locales";
import { matchesQuery, sortTrips } from "@/lib/catalogFilters";
import { fold } from "@/lib/destinations";
import { formatDepartureDate, startingPrice } from "@/lib/departures";
import { formatMnt, hasKnownTripPrice } from "@/lib/pricing";
import { tripStatus } from "@/lib/tripStatus";
import { formatTripTitle } from "@/lib/tripDisplay";
import { destinationHref, type SiteNav } from "@/lib/siteNav";
import type { Trip } from "@/types/trip";

/**
 * Site-wide trip search. Matches the same way the catalogue does (folded
 * Mongolian, Latin place names), shows places and trips as you type, and
 * Enter opens the full catalogue with the query applied.
 */
export default function SearchDialog({
  open,
  onOpenChange,
  nav,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nav: SiteNav;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [now] = useState(() => Date.now());

  const { data: trips, isLoading } = useQuery<Trip[]>({
    queryKey: ["trips", {}],
    queryFn: async () => (await api.get<Trip[]>("/trips")).data,
    enabled: open,
    staleTime: 60_000,
  });

  const trimmed = query.trim();
  const places = useMemo(() => {
    const needle = fold(trimmed);
    if (!needle) return nav.destinations.slice(0, 8);
    return nav.destinations.filter((destination) => fold(`${destination.label} ${destination.country}`).includes(needle)).slice(0, 6);
  }, [nav.destinations, trimmed]);

  const results = useMemo(() => {
    if (!trimmed || !trips) return [];
    return sortTrips(trips.filter((trip) => matchesQuery(trip, trimmed)), "soonest", now).slice(0, 6);
  }, [trips, trimmed, now]);

  const close = () => onOpenChange(false);
  const submit = (event: { preventDefault(): void }) => {
    event.preventDefault();
    if (!trimmed) return;
    track("search_submit", { properties: { query: trimmed.slice(0, 60), from: "header" } });
    close();
    router.push(`${canonicalPath("/trips")}?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setQuery(""); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[hsl(var(--uudam-night)/0.55)] backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="site-theme fixed inset-x-0 top-0 z-[61] flex max-h-[100dvh] flex-col overflow-hidden bg-background shadow-panel data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-4 sm:inset-x-auto sm:left-1/2 sm:top-[9vh] sm:max-h-[80vh] sm:w-[min(44rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:rounded-xl sm:border sm:border-border"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Аялал хайх</DialogPrimitive.Title>
          <form onSubmit={submit} className="flex items-center gap-3 border-b border-border px-4 sm:px-5" role="search">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Хаашаа явмаар байна? Хайнан, Япон, Бали…"
              aria-label="Чиглэл эсвэл аяллын нэр"
              enterKeyHint="search"
              className="h-16 min-w-0 flex-1 bg-transparent text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-[17px]"
            />
            <DialogPrimitive.Close className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-ring" aria-label="Хаах">
              <X className="h-5 w-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </form>

          <div className="overflow-y-auto px-4 py-5 sm:px-5">
            {places.length > 0 && (
              <section aria-label="Чиглэл">
                <p className="eyebrow">{trimmed ? "Чиглэл" : "Түгээмэл чиглэл"}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {places.map((place) => (
                    <li key={place.key}>
                      <Link
                        href={destinationHref(place.key)}
                        onClick={() => {
                          track("destination_select", { properties: { destination: place.key, from: "search" } });
                          close();
                        }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[13px] font-medium text-foreground transition-colors focus-ring hover:border-foreground/35"
                      >
                        <MapPin className="h-3.5 w-3.5 text-gold-text" aria-hidden="true" />
                        {place.label}
                        <span className="text-[11px] tabular-nums text-muted-foreground">{place.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {trimmed ? (
              <section aria-live="polite" aria-label="Аялал" className="mt-6">
                <p className="eyebrow">Аялал</p>
                {isLoading && !trips ? (
                  <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Хайж байна…
                  </p>
                ) : results.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    «{trimmed}» гэсэн аялал олдсонгүй. Өөр үгээр хайх эсвэл{" "}
                    <Link href={canonicalPath("/custom-trip")} onClick={close} className="font-semibold text-foreground underline decoration-gold underline-offset-4">
                      захиалгат аялал хүсэх
                    </Link>
                    .
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-border">
                    {results.map((trip) => {
                      const status = tripStatus(trip, now);
                      const price = startingPrice(trip, now);
                      return (
                        <li key={trip.id}>
                          <Link
                            href={canonicalPath(`/trips/${trip.slug}`)}
                            onClick={close}
                            className="group flex items-center gap-4 rounded-md py-3 focus-ring"
                          >
                            <span className="relative h-14 w-16 shrink-0 overflow-hidden rounded-md bg-sand">
                              {trip.image && <Image src={trip.image} alt="" fill sizes="64px" className="object-cover" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-1 text-[14px] font-semibold text-foreground group-hover:underline">{formatTripTitle(trip.title)}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                                {trip.durationDays} хоног
                                {status.kind === "open" && ` · ${formatDepartureDate(status.departure.startDate)}`}
                                {status.kind === "full" && " · Дүүрсэн"}
                              </span>
                            </span>
                            <span className="shrink-0 text-right text-[13px] font-bold tabular-nums text-foreground">
                              {hasKnownTripPrice(price) ? formatMnt(price) : "Үнэ лавлах"}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={submit}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-foreground focus-ring"
                >
                  <span className="link-draw">«{trimmed}» — бүх үр дүн</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </section>
            ) : (
              <section aria-label="Холбоос" className="mt-6 grid gap-3 sm:grid-cols-2">
                <Link href={canonicalPath("/departures")} onClick={close} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3.5 text-sm font-semibold focus-ring hover:border-foreground/30">
                  Огноогоор хайх — хуваарь
                  <ArrowRight className="h-4 w-4 text-gold-text" aria-hidden="true" />
                </Link>
                <Link href={canonicalPath("/trips")} onClick={close} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3.5 text-sm font-semibold focus-ring hover:border-foreground/30">
                  Бүх {nav.tripCount || ""} аялал
                  <ArrowRight className="h-4 w-4 text-gold-text" aria-hidden="true" />
                </Link>
              </section>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
