import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, json } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/summary — the small counts the admin shows everywhere: the
 * sidebar badges ("3 new enquiries"), the dashboard's "needs attention" list
 * and the numbers on each status filter. Cheap counts only, so every admin
 * page can poll it.
 *
 * Read-only on purpose. A HELD booking whose hold has run out is counted as
 * EXPIRED here — the same relabel GET /api/bookings performs — rather than
 * writing that change from a background poll.
 */
export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  const now = new Date();

  const [enquiryGroups, enquiryKinds, bookingGroups, staleHolds, awaiting, published, drafts] = await Promise.all([
    prisma.enquiry.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.enquiry.groupBy({ by: ["kind"], _count: { _all: true } }),
    prisma.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.booking.count({ where: { status: "HELD", holdExpiresAt: { lt: now } } }),
    prisma.booking.findMany({
      where: {
        OR: [
          { status: "HELD", OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gte: now } }] },
          { status: { in: ["PENDING_PAYMENT", "PARTIALLY_PAID"] } },
        ],
      },
      select: { totalPrice: true, paidAmount: true, holdExpiresAt: true },
    }),
    prisma.trip.count({ where: { isPublished: true } }),
    prisma.trip.count({ where: { isPublished: false } }),
  ]);

  const enquiriesByStatus = Object.fromEntries(enquiryGroups.map((row) => [row.status, row._count._all]));
  const enquiriesByKind = Object.fromEntries(enquiryKinds.map((row) => [row.kind, row._count._all]));

  const bookingsByStatus: Record<string, number> = Object.fromEntries(
    bookingGroups.map((row) => [row.status, row._count._all]),
  );
  if (staleHolds) {
    bookingsByStatus.HELD = Math.max(0, (bookingsByStatus.HELD ?? 0) - staleHolds);
    bookingsByStatus.EXPIRED = (bookingsByStatus.EXPIRED ?? 0) + staleHolds;
  }

  const holds = awaiting
    .map((row) => row.holdExpiresAt?.getTime())
    .filter((time): time is number => typeof time === "number")
    .sort((a, b) => a - b);

  return json({
    enquiries: {
      byStatus: enquiriesByStatus,
      byKind: enquiriesByKind,
      total: enquiryGroups.reduce((sum, row) => sum + row._count._all, 0),
      new: enquiriesByStatus.NEW ?? 0,
    },
    bookings: {
      byStatus: bookingsByStatus,
      total: bookingGroups.reduce((sum, row) => sum + row._count._all, 0),
      awaiting: awaiting.length,
      awaitingAmount: awaiting.reduce((sum, row) => sum + Math.max(0, row.totalPrice - row.paidAmount), 0),
      nextHoldExpiresAt: holds.length ? new Date(holds[0]).toISOString() : null,
    },
    trips: { published, drafts },
  });
});
