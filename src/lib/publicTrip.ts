/**
 * Delivery payloads and review history belong to staff, not the public API.
 * `canonicalOffers` (the chatbot's pre-computed offers, ~40 KB per trip), the
 * content snapshot and the photo-repair log are chatbot bookkeeping no page
 * reads; left in, they were ~80% of every trip's JSON and so of every cached
 * page (ISR writes) and every origin transfer.
 */
export function publicTrip<T extends { sourceMetadata: unknown }>(trip: T): T {
  const metadata = trip.sourceMetadata && typeof trip.sourceMetadata === "object" && !Array.isArray(trip.sourceMetadata)
    ? { ...trip.sourceMetadata } as Record<string, unknown> : null;
  if (metadata) for (const key of ["websiteSyncPending", "canonicalExtraPatch", "website_details_patch", "archivedItinerary", "shared_conflicts", "contentConflicts", "connectedSource", "source_provenance", "answer_hints", "review_reasons", "canonicalOffers", "contentSnapshot", "contentHash", "photo_repair_sources", "photo_repair_source"]) delete metadata[key];
  return { ...trip, sourceMetadata: metadata };
}
