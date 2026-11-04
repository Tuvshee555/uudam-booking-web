import type { BookingStatus } from "@prisma/client";

import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { BookingError, cancelBooking, getPublicBookingStatus, setBookingStatus, type SeatChange } from "@/server/booking";
import { handler, httpError, json, readJson, safeText } from "@/server/http";
import { revalidateSeatChanges } from "@/server/revalidate";

const BOOKING_STATUSES = new Set<string>([
  "HELD",
  "PENDING_PAYMENT",
  "PARTIALLY_PAID",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
]);

/** Refreshes the pages a status change moved seats on; answers with the booking alone. */
function settled<T extends { seatChange: SeatChange | null }>({ seatChange, ...booking }: T) {
  revalidateSeatChanges([seatChange]);
  return json(booking);
}

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
  if (status && !BOOKING_STATUSES.has(status)) throw httpError(400, "Захиалгын төлөв буруу байна");

  const paidAmount =
    body.paidAmount === undefined ? undefined : Number(body.paidAmount);

  if (paidAmount !== undefined && (!Number.isFinite(paidAmount) || paidAmount < 0)) {
    throw httpError(400, "Төлсөн дүн буруу байна");
  }

  try {
    // Cancelling goes through cancelBooking so a departure's seatsLeft is
    // actually given back — a raw status write here would silently leave the
    // seat marked taken forever.
    if (status === "CANCELLED") return settled(await cancelBooking(existing.id, admin.id));

    const data = {
      ...(paidAmount === undefined ? {} : { paidAmount }),
      ...(body.notes === undefined ? {} : { notes: safeText(body.notes, 2000) }),
    };

    // Any other status change goes through setBookingStatus for the same
    // reason in the other direction: recording a payment on a hold the sweep
    // has just expired takes its seats back (or is refused when the date has
    // filled), instead of confirming a booking that holds no seat.
    const booking = status
      ? await setBookingStatus(existing.id, status as BookingStatus, { handledById: admin.id, data })
      : Object.assign(
          await prisma.booking.update({ where: { id: existing.id }, data: { ...data, handledById: admin.id } }),
          { seatChange: null },
        );

    // Mark the transfer paid alongside the booking, so the two can't disagree.
    if (paidAmount !== undefined && paidAmount >= existing.totalPrice) {
      await prisma.payment.updateMany({
        where: { bookingId: existing.id, status: "PENDING" },
        data: { status: "PAID", paidAt: new Date(), confirmedById: admin.id },
      });
    }

    return settled(booking);
  } catch (err) {
    if (err instanceof BookingError) throw httpError(err.status, err.message);
    throw err;
  }
});
