"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CategoryNode, Trip } from "@/types/trip";

/** Published trips, optionally filtered. */
export function useTrips(params?: { category?: string; featured?: boolean; search?: string }) {
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
    staleTime: 60_000,
  });
}

/** A single trip by id or slug. */
export function useTrip(idOrSlug?: string) {
  return useQuery<Trip>({
    queryKey: ["trip", idOrSlug],
    enabled: Boolean(idOrSlug),
    queryFn: async () => {
      const { data } = await api.get<Trip>(`/trips/${idOrSlug}`);
      return data;
    },
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
