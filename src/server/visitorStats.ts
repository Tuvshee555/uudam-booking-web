import { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";

/**
 * People, not clicks.
 *
 * Every number here counts DISTINCT visitor ids. A visitor id is made up by
 * the browser once and kept, so one phone that opens the site 100 times, or
 * taps a departure date 166 times, is still one visitor. (A person who uses a
 * phone and a laptop is two: nothing identifies a person across devices.)
 */

export type VisitorStats = {
  /** Distinct visitors today / in the last 7 days / this month (Mongolian time). */
  visitors: { today: number; week: number; month: number };
  /** Page views this month, kept next to visitors so "how many times" stays visible. */
  viewsMonth: number;
  /** This month's visitors who had also visited before this month. */
  returningMonth: number;
  /** Distinct visitors this month by device: mobile, desktop, tablet, unknown. */
  devices: Record<string, number>;
  /** Per funnel signal: people who did it, and how many times in total. */
  engagement: Record<string, { people: number; times: number }>;
  /** People who tapped share, by channel. */
  sharesByChannel: Array<{ channel: string; people: number }>;
};

const MONGOLIA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Midnight at the start of today in Mongolia, as a real instant. */
export function mongoliaDayStart(now: Date): Date {
  const local = new Date(now.getTime() + MONGOLIA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - MONGOLIA_OFFSET_MS);
}

/** Midnight at the start of this month in Mongolia. */
export function mongoliaMonthStart(now: Date): Date {
  const local = new Date(now.getTime() + MONGOLIA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - MONGOLIA_OFFSET_MS);
}

export async function getVisitorStats(now = new Date()): Promise<VisitorStats> {
  const dayStart = mongoliaDayStart(now);
  const monthStart = mongoliaMonthStart(now);
  const weekStart = new Date(dayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  const earliest = weekStart < monthStart ? weekStart : monthStart;

  const [totals, returning, devices, engagement, shares] = await Promise.all([
    prisma.$queryRaw<Array<{ today: number; week: number; month: number; views: number }>>(Prisma.sql`
      SELECT
        COUNT(DISTINCT "visitorId") FILTER (WHERE "createdAt" >= ${dayStart})::int AS today,
        COUNT(DISTINCT "visitorId") FILTER (WHERE "createdAt" >= ${weekStart})::int AS week,
        COUNT(DISTINCT "visitorId") FILTER (WHERE "createdAt" >= ${monthStart})::int AS month,
        COUNT(*) FILTER (WHERE "createdAt" >= ${monthStart})::int AS views
      FROM "TripView" WHERE "createdAt" >= ${earliest}`),
    prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT v."visitorId")::int AS n
      FROM "TripView" v
      WHERE v."createdAt" >= ${monthStart}
        AND EXISTS (SELECT 1 FROM "TripView" p WHERE p."visitorId" = v."visitorId" AND p."createdAt" < ${monthStart})`),
    prisma.$queryRaw<Array<{ device: string | null; n: number }>>(Prisma.sql`
      SELECT device, COUNT(DISTINCT "visitorId")::int AS n
      FROM "TripView" WHERE "createdAt" >= ${monthStart} GROUP BY device`),
    prisma.$queryRaw<Array<{ name: string; people: number; times: number }>>(Prisma.sql`
      SELECT name, COUNT(DISTINCT "visitorId")::int AS people, COUNT(*)::int AS times
      FROM "AnalyticsEvent" WHERE "createdAt" >= ${monthStart} GROUP BY name`),
    prisma.$queryRaw<Array<{ channel: string; people: number }>>(Prisma.sql`
      SELECT COALESCE(NULLIF(properties->>'channel', ''), 'other') AS channel, COUNT(DISTINCT "visitorId")::int AS people
      FROM "AnalyticsEvent" WHERE name = 'share_click' AND "createdAt" >= ${monthStart}
      GROUP BY 1 ORDER BY people DESC`),
  ]);

  const total = totals[0] ?? { today: 0, week: 0, month: 0, views: 0 };
  const deviceCounts: Record<string, number> = {};
  for (const row of devices) {
    const key = row.device && ["mobile", "desktop", "tablet"].includes(row.device) ? row.device : "unknown";
    deviceCounts[key] = (deviceCounts[key] ?? 0) + row.n;
  }
  return {
    visitors: { today: total.today, week: total.week, month: total.month },
    viewsMonth: total.views,
    returningMonth: returning[0]?.n ?? 0,
    devices: deviceCounts,
    engagement: Object.fromEntries(engagement.map((row) => [row.name, { people: row.people, times: row.times }])),
    sharesByChannel: shares,
  };
}
