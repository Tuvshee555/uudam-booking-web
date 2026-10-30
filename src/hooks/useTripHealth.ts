"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { HealthIssue } from "@/lib/tripHealth";

export type TripHealthReport = {
  generatedAt: string;
  publishedTrips: number;
  errors: number;
  warnings: number;
  fingerprint: string;
  issues: HealthIssue[];
};

/**
 * The automatic trip checks (see src/lib/tripHealth.ts).
 *
 * `enabled: false` reads whatever report another screen already fetched
 * without starting one — the check reads partner price tables over the
 * network, so the sidebar badge must never be what triggers it.
 */
export function useTripHealth(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["admin", "trip-health"],
    queryFn: async () => (await api.get("/admin/trip-health")).data as TripHealthReport,
    staleTime: 5 * 60_000,
    enabled: options?.enabled ?? true,
  });
}
