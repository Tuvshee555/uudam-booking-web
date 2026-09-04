import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, json } from "@/server/http";

/**
 * GET /api/stats — the office dashboard.
 *
 * There is no revenue here on purpose: money is taken off-site, so the only
 * numbers this app can honestly report are about enquiries and the catalogue.
 * Showing a "revenue" figure derived from unconfirmed requests would be a lie.
 */
export const GET = handler(async (req: Request) => {
  await requireAdmin(req);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    newCount,
    weekCount,
    monthCount,
    confirmedCount,
    tripCount,
    draftCount,
    recent,
    upcoming,
    eventCounts,
    byTrip,
  ] = await Promise.all([
    prisma.enquiry.count({ where: { status: "NEW" } }),
    prisma.enquiry.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.enquiry.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.enquiry.count({ where: { status: { in: ["CONFIRMED", "COMPLETED"] } } }),
    prisma.trip.count({ where: { isPublished: true } }),
    prisma.trip.count({ where: { isPublished: false } }),

    prisma.enquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        reference: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        adults: true,
        children: true,
        infants: true,
        departureDate: true,
        createdAt: true,
        trip: { select: { id: true, title: true, image: true } },
      },
    }),

    prisma.departure.findMany({
      where: { startDate: { gte: now }, status: { notIn: ["CANCELLED", "DEPARTED"] } },
      orderBy: { startDate: "asc" },
      take: 8,
      select: {
        id: true,
        startDate: true,
        seatsLeft: true,
        seatsTotal: true,
        status: true,
        trip: { select: { id: true, title: true, image: true } },
      },
    }),

    // Funnel signals that aren't a full enquiry: shares, saves, phone/Messenger
    // taps, departure picks. Answers "does anyone engage before not enquiring?"
    prisma.analyticsEvent.groupBy({
      by: ["name"],
      where: { createdAt: { gte: monthStart } },
      _count: { name: true },
    }),

    // Which trips people are actually asking about — the signal the agency
    // can act on when deciding what to post next.
    prisma.enquiry.groupBy({
      by: ["tripId"],
      where: { tripId: { not: null }, createdAt: { gte: monthStart } },
      _count: { tripId: true },
      orderBy: { _count: { tripId: "desc" } },
      take: 5,
    }),
  ]);

  const topTripIds = byTrip
    .map((row) => row.tripId)
    .filter((id): id is string => Boolean(id));

  const topTripRows = topTripIds.length
    ? await prisma.trip.findMany({
        where: { id: { in: topTripIds } },
        select: { id: true, title: true, image: true, price: true },
      })
    : [];

  const tripById = new Map(topTripRows.map((trip) => [trip.id, trip]));

  return json({
    stats: {
      newCount,
      weekCount,
      monthCount,
      confirmedCount,
      tripCount,
      draftCount,
    },
    // 30-day funnel signal counts, e.g. { share_click: 12, phone_click: 4 }.
    events: Object.fromEntries(eventCounts.map((row) => [row.name, row._count.name])),
    recentEnquiries: recent,
    upcomingDepartures: upcoming,
    topTrips: byTrip
      .map((row) => {
        const trip = row.tripId ? tripById.get(row.tripId) : undefined;
        return trip ? { ...trip, enquiryCount: row._count.tripId } : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
  });
});
