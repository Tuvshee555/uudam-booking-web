"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type AdminSummary = {
  enquiries: { byStatus: Record<string, number>; byKind: Record<string, number>; total: number; new: number };
  bookings: {
    byStatus: Record<string, number>;
    total: number;
    awaiting: number;
    awaitingAmount: number;
    nextHoldExpiresAt: string | null;
  };
  trips: { published: number; drafts: number };
};

/**
 * Work-queue data goes stale while staff are on the phone, so admin lists
 * refetch whenever they are opened or the tab regains focus — unlike the
 * storefront, whose app-wide defaults keep data for minutes.
 */
export const LIVE_QUERY = { staleTime: 15_000, refetchOnMount: true, refetchOnWindowFocus: true } as const;

export const ADMIN_SUMMARY_KEY = ["admin", "summary"] as const;

/** Counts behind the sidebar badges, the dashboard and every status filter. */
export function useAdminSummary() {
  return useQuery<AdminSummary>({
    queryKey: ADMIN_SUMMARY_KEY,
    queryFn: async () => (await api.get<AdminSummary>("/admin/summary")).data,
    ...LIVE_QUERY,
    refetchInterval: 60_000,
  });
}
