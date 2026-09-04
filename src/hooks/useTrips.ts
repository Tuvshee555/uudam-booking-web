"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CategoryNode, Trip } from "@/types/trip";

/**
 * Published trips, optionally filtered.
 *
 * `initialData` serves the same purpose as in `useTrip`: the catalogue page
 * queries the list on the server and seeds it here, so the cards exist in the
 * initial HTML instead of appearing only once this request resolves.
 */
export function useTrips(
  params?: { category?: string; featured?: boolean; search?: string },
  initialData?: Trip[],
) {
  return useQuery<Trip[]>({
    queryKey: ["trips", params ?? {}],
    queryFn: async () => {
      const { data } = await api.get<Trip[]>("/trips", {
        params: {
          category: params?.category,
          featured: params?.featured ? "true" : undefined,
          search: params?.search || undefined,
        },
      });
      return data;
    },
    initialData,
    staleTime: 60_000,
  });
}

/**
 * A single trip by id or slug.
 *
 * `initialData` lets the server page hand over the trip it already queried for
 * `generateMetadata`. Without it the first paint has no trip, so the whole page
 * body — title, itinerary, price, departures — was missing from the initial
 * HTML and only appeared after this request resolved in the browser. Crawlers
 * and Messenger unfurlers saw an empty shell.
 */
export function useTrip(idOrSlug?: string, initialData?: Trip) {
  return useQuery<Trip>({
    queryKey: ["trip", idOrSlug],
    enabled: Boolean(idOrSlug),
    queryFn: async () => {
      const { data } = await api.get<Trip>(`/trips/${idOrSlug}`);
      return data;
    },
    initialData,
    staleTime: 60_000,
  });
}

export type FlatCategory = {
  id: string;
  categoryName: string;
  slug: string | null;
  description: string | null;
  image: string | null;
  parentId: string | null;
  tripCount: number;
  childrenCount: number;
  hasChildren: boolean;
};

export function useCategories(parentId?: string) {
  return useQuery<FlatCategory[]>({
    queryKey: ["categories", parentId ?? "all"],
    queryFn: async () => {
      const { data } = await api.get<FlatCategory[]>("/categories", {
        params: { parentId },
      });
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCategoryTree() {
  return useQuery<CategoryNode[]>({
    queryKey: ["categories", "tree"],
    queryFn: async () => {
      const { data } = await api.get<CategoryNode[]>("/categories/tree");
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

/** Trips within a category, including every descendant category. */
export function useCategoryTrips(idOrSlug?: string) {
  return useQuery<{ category: { id: string; categoryName: string }; trips: Trip[] }>({
    queryKey: ["categories", idOrSlug, "trips"],
    enabled: Boolean(idOrSlug),
    queryFn: async () => {
      const { data } = await api.get(`/categories/${idOrSlug}/trips`);
      return data;
    },
    staleTime: 60_000,
  });
}

export type FlatTag = { id: string; name: string; slug: string; tripCount: number };

/** Free-form trip labels staff create themselves. Starts empty. */
export function useTags() {
  return useQuery<FlatTag[]>({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data } = await api.get<FlatTag[]>("/tags");
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export type PriceBand = {
  id: string;
  name: string;
  minPrice: number;
  maxPrice: number | null;
  sortOrder: number;
};

/** Admin-authored price ranges, e.g. "0–1 сая". */
export function usePriceBands() {
  return useQuery<PriceBand[]>({
    queryKey: ["priceBands"],
    queryFn: async () => {
      const { data } = await api.get<PriceBand[]>("/price-bands");
      return data;
    },
    staleTime: 5 * 60_000,
  });
}
