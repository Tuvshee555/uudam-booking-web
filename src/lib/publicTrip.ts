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
  // `weather` (~2 KB of climate normals per place, 65 KB across the catalogue) is read
  // only by /api/trips/[id]/weather straight from the database, never by a page.
  const rest = { ...trip, sourceMetadata: metadata } as T & { weather?: unknown };
  delete rest.weather;
  return rest;
}

/**
 * The catalogue cards (home, trips, departures, saved, category) show a title,
 * photo, price, dates and badges. The day-by-day itinerary, extra photos and the
 * itinerary copy inside sourceMetadata were ~45% of every list payload and are
 * only drawn on the trip's own page, which loads the full record.
 */
export function listTrip<T extends { sourceMetadata: unknown; itinerary?: unknown; extraImages?: unknown }>(trip: T): T {
  const base = publicTrip(trip) as T & { sourceMetadata: Record<string, unknown> | null };
  // The per-day meal states go with the day-by-day itinerary: drawn only on the trip's page.
  if (base.sourceMetadata) { delete base.sourceMetadata.itinerary_days; delete base.sourceMetadata.itineraryMeals; }
  return { ...base, itinerary: [], extraImages: [] };
}

/**
 * The only sourceMetadata a card reads: the sale badge and its seat facts.
 * Everything else in it (fare tables, conflict history, photo credits) belongs
 * to the trip's own page.
 */
export const SUMMARY_METADATA_KEYS = ["marketingBadge", "marketing_badge", "seats_left", "seats_total"] as const;

/**
 * The fields a trip card, the catalogue filters and the departure calendar
 * read, with every long-form field emptied. Shaped like a full Trip so the
 * same card and filter code takes either.
 */
export function summaryFields<T extends object>(row: T, metadata: Record<string, unknown> | null) {
  return {
    ...row,
    description: "",
    sourceMetadata: metadata && Object.keys(metadata).length ? metadata : null,
    meetingPoint: null,
    latitude: null,
    longitude: null,
    mapUrl: null,
    highlights: [] as string[],
    included: [] as string[],
    excluded: [] as string[],
    requirements: null,
    cancellationPolicy: null,
    importantNotes: [] as string[],
    extraImages: [] as string[],
    hotel: null,
    departureRule: null,
    extraFees: [] as string[],
    roomPrices: [] as string[],
    childPriceNotes: [] as string[],
    itinerary: [] as never[],
  };
}
