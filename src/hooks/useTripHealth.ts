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

/** The automatic trip checks (see src/lib/tripHealth.ts). */
export function useTripHealth() {
  return useQuery({
    queryKey: ["admin", "trip-health"],
    queryFn: async () => (await api.get("/admin/trip-health")).data as TripHealthReport,
    staleTime: 5 * 60_000,
  });
}
