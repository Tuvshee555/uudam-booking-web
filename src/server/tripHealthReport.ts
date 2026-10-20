import { createHash } from "node:crypto";
import { prisma, withPrismaRetry } from "./prisma";
import { departureDateKey } from "@/lib/departureDate.js";
import { checkCatalog, comparePartnerFares, type HealthIssue, type HealthTrip } from "@/lib/tripHealth";
import { PARTNER_TRIPS, fetchGtcFares } from "./partnerFares";

export type TripHealthReport = {
  generatedAt: string;
  publishedTrips: number;
  errors: number;
  warnings: number;
  /** Changes only when the set of problems changes; the daily alert uses it to stay quiet. */
  fingerprint: string;
  issues: HealthIssue[];
};

type SyncRow = { trip_id: string; last_error: string | null; pending: boolean; website_trip_id: string | null };

/** Every check, run against the live database and partner tables. */
export async function buildTripHealthReport(now = new Date()): Promise<TripHealthReport> {
  const today = departureDateKey(now);
  const trips = await withPrismaRetry(() => prisma.trip.findMany({
    select: {
      id: true, slug: true, title: true, isPublished: true, price: true, image: true, sourceTripId: true, sourceMetadata: true,
      departures: { select: { startDate: true, status: true, price: true, childPrice: true, seatsLeft: true }, orderBy: { startDate: "asc" } },
    },
  }));
  const healthTrips = trips as unknown as Array<HealthTrip & { sourceTripId: string | null }>;
  const issues = checkCatalog(healthTrips, today, now.getTime());

  for (const config of PARTNER_TRIPS) {
    const trip = healthTrips.find((entry) => entry.sourceTripId === config.sourceTripId);
    if (!trip?.isPublished) continue;
    try {
      issues.push(...comparePartnerFares(trip, config.partner, await fetchGtcFares(config.slug, config.hotels), today));
    } catch (error) {
      issues.push({ tripId: trip.id, slug: trip.slug, title: trip.title, severity: "warning", code: "partner_unreachable",
        message: `${config.partner}-ийн үнийн хүснэгтийг уншиж чадсангүй (${error instanceof Error ? error.message : "алдаа"}).` });
    }
  }

  // The chatbot's delivery queue lives in the same database: a trip whose
  // canonical change never reached the website is out of date here.
  const sync = await prisma.$queryRaw<SyncRow[]>`
    SELECT trip_id, last_error, (revision > synced_revision AND updated_at < NOW() - interval '15 minutes') AS pending, website_trip_id
    FROM trip_website_sync
    WHERE last_error IS NOT NULL OR (revision > synced_revision AND updated_at < NOW() - interval '15 minutes')`.catch(() => [] as SyncRow[]);
  for (const row of sync) {
    const trip = healthTrips.find((entry) => entry.sourceTripId === row.trip_id || entry.id === row.website_trip_id);
    if (trip && !trip.isPublished) continue;
    issues.push({ tripId: trip?.id ?? row.trip_id, slug: trip?.slug ?? "", title: trip?.title ?? row.trip_id, severity: "error", code: "chatbot_sync_failed",
      message: row.last_error ? `Chatbot-оос сайт руу синк амжилтгүй: ${row.last_error.slice(0, 160)}` : "Chatbot-ийн өөрчлөлт сайтад 15 минутаас удаан ирээгүй байна." });
  }

  issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1) || a.title.localeCompare(b.title, "mn"));
  const fingerprint = createHash("sha256").update(JSON.stringify(issues.map((issue) => [issue.tripId, issue.code, issue.message]))).digest("hex").slice(0, 16);
  return {
    generatedAt: now.toISOString(),
    publishedTrips: trips.filter((trip) => trip.isPublished).length,
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
    fingerprint,
    issues,
  };
}
