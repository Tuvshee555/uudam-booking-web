/** Delivery payloads and review history belong to staff, not the public API. */
export function publicTrip<T extends { sourceMetadata: unknown }>(trip: T): T {
  const metadata = trip.sourceMetadata && typeof trip.sourceMetadata === "object" && !Array.isArray(trip.sourceMetadata)
    ? { ...trip.sourceMetadata } as Record<string, unknown> : null;
  if (metadata) for (const key of ["websiteSyncPending", "canonicalExtraPatch", "website_details_patch", "archivedItinerary", "shared_conflicts", "contentConflicts", "connectedSource", "source_provenance", "answer_hints", "review_reasons"]) delete metadata[key];
  return { ...trip, sourceMetadata: metadata };
}
