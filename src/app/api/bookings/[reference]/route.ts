import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { getPublicBookingStatus } from "@/server/booking";
import { handler, httpError, json, readJson, safeText } from "@/server/http";

type Ctx = { params: Promise<{ reference: string }> };

/**
 * GET /api/bookings/:reference — public lookup by reference code.
 *
 * There are no customer accounts, so the reference *is* the credential. It's
 * a 5-character code, so this returns only what the holder already knows —
 * their own trip, dates and amount — and never the phone or email on file,
 * which would turn a guessable code into a data leak.
 */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { reference } = await ctx.params;

  const booking = await getPublicBookingStatus(reference);

  if (!booking) throw httpError(404, "Захиалга олдсонгүй");

  return json(booking);
});

/** PATCH /api/bookings/:reference — staff update status / record payment. */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin(req);

  const { reference } = await ctx.params;
  const body = await readJson(req);

  const existing = await prisma.booking.findUnique({
    where: { reference: reference.toUpperCase() },
    select: { id: true, totalPrice: true },
  });
  if (!existing) throw httpError(404, "Захиалга олдсонгүй");

  const status = safeText(body.status, 40);
  const paidAmount =
    body.paidAmount === undefined ? undefined : Number(body.paidAmount);

  if (paidAmount !== undefined && (!Number.isFinite(paidAmount) || paidAmount < 0)) {
    throw httpError(400, "Төлсөн дүн буруу байна");
  }

  const booking = await prisma.booking.update({
    where: { id: existing.id },
    data: {
      ...(status ? { status: status as never } : {}),
      ...(paidAmount === undefined ? {} : { paidAmount }),
      ...(body.notes === undefined ? {} : { notes: safeText(body.notes, 2000) }),
      handledById: admin.id,
      // A confirmed booking no longer needs a hold — it isn't provisional.
      ...(status === "CONFIRMED" || status === "COMPLETED"
        ? { holdExpiresAt: null }
        : {}),
    },
  });

  // Mark the transfer paid alongside the booking, so the two can't disagree.
  if (paidAmount !== undefined && paidAmount >= existing.totalPrice) {
    await prisma.payment.updateMany({
      where: { bookingId: existing.id, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date(), confirmedById: admin.id },
    });
  }

  return json(booking);
});
