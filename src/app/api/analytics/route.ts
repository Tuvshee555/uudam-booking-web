import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, json, parsePositiveInt } from "@/server/http";

/**
 * GET /api/analytics?days=30 — traffic and conversion.
 *
 * Everything here is derived from first-party TripView rows plus the enquiries
 * they led to. The one number the agency actually needs is the last column of
 * the per-trip table: how many people looked, versus how many picked up the
 * phone.
 */
export const GET = handler(async (req: Request) => {
  await requireAdmin(req);

  const url = new URL(req.url);
  const days = parsePositiveInt(url.searchParams.get("days"), 30, 365);

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  // Previous window of equal length, for the trend arrows.
  const prevSince = new Date(since);
  prevSince.setDate(prevSince.getDate() - days);

  const [
    totalViews,
    uniqueVisitors,
    prevViews,
    prevVisitors,
    enquiryCount,
    prevEnquiryCount,
    perTripViews,
    perTripEnquiries,
    referrers,
    devices,
    dailyRows,
    topPages,
  ] = await Promise.all([
    prisma.tripView.count({ where: { createdAt: { gte: since } } }),

    prisma.tripView
      .findMany({
        where: { createdAt: { gte: since } },
        select: { visitorId: true },
        distinct: ["visitorId"],
      })
      .then((rows) => rows.length),

    prisma.tripView.count({ where: { createdAt: { gte: prevSince, lt: since } } }),

    prisma.tripView
      .findMany({
        where: { createdAt: { gte: prevSince, lt: since } },
        select: { visitorId: true },
        distinct: ["visitorId"],
      })
      .then((rows) => rows.length),

    prisma.enquiry.count({ where: { createdAt: { gte: since } } }),
    prisma.enquiry.count({ where: { createdAt: { gte: prevSince, lt: since } } }),

    prisma.tripView.groupBy({
      by: ["tripId"],
      where: { createdAt: { gte: since }, tripId: { not: null } },
      _count: { _all: true },
      _sum: { durationMs: true, videoPlays: true },
      _avg: { durationMs: true },
    }),

    prisma.enquiry.groupBy({
      by: ["tripId"],
      where: { createdAt: { gte: since }, tripId: { not: null } },
      _count: { _all: true },
    }),

    prisma.tripView.groupBy({
      by: ["referrer"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { referrer: "desc" } },
      take: 8,
    }),

    prisma.tripView.groupBy({
      by: ["device"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),

    prisma.tripView.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, visitorId: true },
    }),

    prisma.tripView.groupBy({
      by: ["path"],
      where: { createdAt: { gte: since }, tripId: null },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 8,
    }),
  ]);

  const tripIds = [
    ...new Set(
      [...perTripViews, ...perTripEnquiries]
        .map((row) => row.tripId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const trips = tripIds.length
    ? await prisma.trip.findMany({
        where: { id: { in: tripIds } },
        select: { id: true, slug: true, title: true, image: true, price: true },
      })
    : [];

  const tripById = new Map(trips.map((trip) => [trip.id, trip]));
  const enquiriesByTrip = new Map(
    perTripEnquiries.map((row) => [row.tripId, row._count._all]),
  );

  // Unique visitors per trip can't come out of the same groupBy, so it needs
  // its own distinct pass.
  const uniquePerTrip = await prisma.tripView.findMany({
    where: { createdAt: { gte: since }, tripId: { not: null } },
    select: { tripId: true, visitorId: true },
    distinct: ["tripId", "visitorId"],
  });

  const uniqueByTrip = new Map<string, number>();
  for (const row of uniquePerTrip) {
    if (!row.tripId) continue;
    uniqueByTrip.set(row.tripId, (uniqueByTrip.get(row.tripId) ?? 0) + 1);
  }

  const tripStats = perTripViews
    .map((row) => {
      const trip = row.tripId ? tripById.get(row.tripId) : null;
      if (!trip) return null;

      const views = row._count._all;
      const enquiries = enquiriesByTrip.get(row.tripId) ?? 0;

      return {
        ...trip,
        views,
        visitors: uniqueByTrip.get(trip.id) ?? 0,
        enquiries,
        // Percent of views that turned into a phone call. This is the column
        // that tells the agency which trips are worth promoting.
        conversionRate: views > 0 ? Number(((enquiries / views) * 100).toFixed(1)) : 0,
        avgDurationMs: Math.round(row._avg.durationMs ?? 0),
        totalDurationMs: row._sum.durationMs ?? 0,
        videoPlays: row._sum.videoPlays ?? 0,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.views - a.views);

  // Trips that got enquiries but no recorded views — usually someone arriving
  // from a link before analytics existed, or a blocked tracker.
  for (const row of perTripEnquiries) {
    if (!row.tripId || tripStats.some((stat) => stat.id === row.tripId)) continue;
    const trip = tripById.get(row.tripId);
    if (!trip) continue;

    tripStats.push({
      ...trip,
      views: 0,
      visitors: 0,
      enquiries: row._count._all,
      conversionRate: 0,
      avgDurationMs: 0,
      totalDurationMs: 0,
      videoPlays: 0,
    });
  }

  const dailyMap = new Map<string, { views: number; visitors: Set<string> }>();
  for (const row of dailyRows) {
    const key = new Date(row.createdAt).toISOString().slice(0, 10);
    const entry = dailyMap.get(key) ?? { views: 0, visitors: new Set<string>() };
    entry.views += 1;
    entry.visitors.add(row.visitorId);
    dailyMap.set(key, entry);
  }

  const daily = Array.from(dailyMap.entries())
    .map(([date, entry]) => ({ date, views: entry.views, visitors: entry.visitors.size }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // The most recent leads, each with where they came from.
  const recentEnquiries = await prisma.enquiry.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      reference: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      referrer: true,
      source: true,
      visitorId: true,
      createdAt: true,
      trip: { select: { id: true, title: true, slug: true } },
    },
  });

  return json({
    range: { days, since: since.toISOString() },
    totals: {
      views: totalViews,
      visitors: uniqueVisitors,
      enquiries: enquiryCount,
      conversionRate:
        totalViews > 0 ? Number(((enquiryCount / totalViews) * 100).toFixed(1)) : 0,
      previous: {
        views: prevViews,
        visitors: prevVisitors,
        enquiries: prevEnquiryCount,
      },
    },
    daily,
    trips: tripStats,
    referrers: referrers.map((row) => ({
      referrer: row.referrer ?? "Шууд орсон",
      count: row._count._all,
    })),
    devices: devices.map((row) => ({ device: row.device ?? "unknown", count: row._count._all })),
    topPages: topPages.map((row) => ({ path: row.path, count: row._count._all })),
    recentEnquiries,
  });
});
