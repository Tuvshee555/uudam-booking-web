import type { BookingStatus, Prisma } from "@prisma/client";

import { prisma, withPrismaRetry } from "@/server/prisma";
import { checkInvoice } from "@/server/qpay";
import { availability } from "@/lib/departures";
import { hasMissingPassengerFare, lineTotal, resolvePrices, totalHeadcount } from "@/lib/pricing";
import { hasVariablePricing } from "@/lib/tripPriceOptions";
import type { Departure } from "@/types/trip";

/**
 * Statuses that are actively holding a seat out of sale.
 *
 * EXPIRED and CANCELLED are not here on purpose — their seats are back on
 * sale. COMPLETED is: the trip has been and gone, but the seat was still
 * consumed, so it must keep counting against a past departure's capacity.
 */
export const SEAT_HOLDING_STATUSES = [
  "HELD",
  "PENDING_PAYMENT",
  "PARTIALLY_PAID",
  "CONFIRMED",
  "COMPLETED",
] as const;

/** How long an unpaid booking keeps its seats before the sweep releases them. */
export const HOLD_MINUTES = 60;

/** A repeat of the same booking inside this window is the same booking. */
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

const HOLDING = new Set<string>(SEAT_HOLDING_STATUSES);

/**
 * Every transaction that moves seats queues on the departure row (see
 * createBooking), so a burst of simultaneous requests spends real time
 * waiting rather than failing instantly. Defaults (5s/2s) were too tight for
 * that queue to drain under a handful of concurrent requests; still short
 * enough to fail fast under genuine overload rather than hang.
 */
const SEAT_TRANSACTION = { timeout: 10_000, maxWait: 10_000 };
const SEAT_RETRY = { attempts: 2, retryCodes: ["P2028", "P2034"] };

/**
 * What a change did to a date's seats, so the caller can refresh the pages
 * that show it. Null when no seat moved.
 */
export type SeatChange = {
  slug: string;
  /**
   * The date went from bookable to sold out or back. Lists, cards and the
   * calendar only ever show that, never a count (see availability() in
   * lib/departures), so only then do they need refreshing too.
   */
  availabilityChanged: boolean;
};

function bookable(status: string, seatsLeft: number | null) {
  return availability({ status, seatsLeft } as Departure).selectable;
}

/** Locks the departure row and returns its seat count as it stands under the lock. */
async function lockDeparture(tx: Prisma.TransactionClient, departureId: string) {
  const [row] = await tx.$queryRaw<{ seatsLeft: number | null }[]>`
    SELECT "seatsLeft" FROM "Departure" WHERE id = ${departureId} FOR UPDATE`;
  return row ?? null;
}

/** Compares a date's seats now (inside the same transaction) with `before`. */
async function describeSeatChange(
  tx: Prisma.TransactionClient,
  departureId: string,
  before: number | null,
): Promise<SeatChange | null> {
  const row = await tx.departure.findUnique({
    where: { id: departureId },
    select: { seatsLeft: true, status: true, trip: { select: { slug: true } } },
  });
  if (!row || row.seatsLeft === before) return null;
  return {
    slug: row.trip.slug,
    availabilityChanged: bookable(row.status, before) !== bookable(row.status, row.seatsLeft),
  };
}

/**
 * Relabel this date's holds that ran out and give their seats back. The
 * caller holds the departure lock. Each hold changes with a conditional
 * update, so one that became a payment a moment ago (QPay, staff) is left
 * alone instead of having its seats released from under it.
 */
async function releaseExpiredHolds(tx: Prisma.TransactionClient, departureId: string) {
  const now = new Date();
  const stale = await tx.booking.findMany({
    where: { departureId, status: "HELD", holdExpiresAt: { lt: now } },
    select: { id: true, adults: true, children: true, infants: true },
  });

  let holds = 0;
  let seats = 0;
  for (const hold of stale) {
    const { count } = await tx.booking.updateMany({
      where: { id: hold.id, status: "HELD", holdExpiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    });
    if (!count) continue;
    holds += 1;
    seats += hold.adults + hold.children + hold.infants;
  }

  if (seats) {
    await tx.departure.updateMany({
      where: { id: departureId, seatsLeft: { not: null } },
      data: { seatsLeft: { increment: seats } },
    });
  }
  return holds;
}

/**
 * The public booking-status lookup — shared by GET /api/bookings/:reference
 * and the status page's server render, so the shape can't drift between the
 * two the way it would if each hand-wrote its own `select`.
 *
 * Deliberately narrow: there are no customer accounts, so this reference code
 * is the only credential guarding it. It returns exactly what the holder of
 * a 5-character code already knows — their own trip, dates, amount — and
 * never phone or email, which would turn a guessable code into a data leak.
 */
export async function getPublicBookingStatus(reference: string) {
  return prisma.booking.findUnique({
    where: { reference: reference.toUpperCase() },
    select: {
      reference: true,
      status: true,
      adults: true,
      children: true,
      infants: true,
      totalPrice: true,
      paidAmount: true,
      currency: true,
      holdExpiresAt: true,
      createdAt: true,
      firstName: true,
      trip: { select: { title: true, slug: true, image: true } },
      departure: { select: { startDate: true, endDate: true } },
      payments: {
        select: { reference: true, method: true, status: true, amount: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export class BookingError extends Error {
  // A plain field rather than a constructor parameter property, so the
  // node test runner (type stripping only) can load this module.
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type CreateBookingInput = {
  tripId: string;
  departureId: string;
  adults: number;
  children: number;
  infants: number;
  firstName: string;
  lastName?: string | null;
  phone: string;
  email?: string | null;
  notes?: string | null;
  source?: string | null;
  visitorId?: string | null;
  reference: string;
  paymentReference: string;
};

/**
 * Create a booking and hold its seats atomically.
 *
 * The capacity check and the insert have to be one transaction: checking
 * first and inserting after is exactly how two people end up buying the same
 * last seat. Prices are recomputed here from the database and snapshotted
 * onto the row — whatever the browser posted about money is ignored.
 */
export async function createBooking(input: CreateBookingInput) {
  const seats = totalHeadcount({
    adults: input.adults,
    children: input.children,
    infants: input.infants,
  });

  if (seats < 1) throw new BookingError("Хамгийн багадаа нэг хүн сонгоно уу");

  // A connection Neon dropped while the site sat idle stalls the first
  // attempt until the transaction times out (P2028), with nothing written: it
  // rolls back. One more try on a fresh connection; the duplicate check below
  // keeps even the retry of an attempt that did commit from booking twice.
  return withPrismaRetry(() => prisma.$transaction(async (tx) => {
    // Locks the departure row for the rest of this transaction. Without this,
    // "read how many seats are taken, then insert if there's room" is not
    // atomic under Postgres's default READ COMMITTED isolation: two
    // concurrent transactions can both read the same "0 taken" count before
    // either commits, and both insert. Verified directly — 5 simultaneous
    // requests against a 1-seat departure all succeeded before this line
    // existed. FOR UPDATE makes every other transaction booking this same
    // departure block here until this one commits or rolls back, so the next
    // one in line re-reads the true, post-commit count.
    const before = (await lockDeparture(tx, input.departureId))?.seatsLeft ?? null;

    // Holds on this date that ran out but were not swept yet still count
    // against seatsLeft. Releasing them here, under the same lock, means an
    // abandoned checkout never turns the next customer away.
    const released = await releaseExpiredHolds(tx, input.departureId);

    // A double tap, a retry after a slow network or a resubmitted form must
    // not hold the same seats twice: the same phone booking the same date for
    // the same party within a few minutes gets the booking it already made.
    // Checked under the row lock, so two identical requests at the same
    // instant queue here and the second one sees the first.
    const duplicate = await tx.booking.findFirst({
      where: {
        departureId: input.departureId,
        phone: input.phone,
        adults: input.adults,
        children: input.children,
        infants: input.infants,
        status: { in: ["HELD", "PENDING_PAYMENT"] },
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
      include: { payments: true },
    });
    // A retry can find the booking its own first attempt committed after all:
    // that one is still this request's new booking, not a repeat.
    if (duplicate) {
      return Object.assign(duplicate, {
        duplicate: duplicate.reference !== input.reference,
        seatChange: released ? await describeSeatChange(tx, input.departureId, before) : null,
      });
    }

    const departure = await tx.departure.findUnique({
      where: { id: input.departureId },
      select: {
        id: true,
        tripId: true,
        price: true,
        childPrice: true,
        infantPrice: true,
        status: true,
        startDate: true,
        seatsLeft: true,
      },
    });

    if (!departure || departure.tripId !== input.tripId) {
      throw new BookingError("Сонгосон огноо олдсонгүй", 404);
    }

    const trip = await tx.trip.findUnique({
      where: { id: input.tripId },
      select: {
        id: true,
        slug: true,
        isPublished: true,
        price: true,
        childPrice: true,
        infantPrice: true,
        sourceMetadata: true,
      },
    });

    // An unpublished trip is a 404 here too, matching the storefront: a taken
    // down trip must not still be sellable to anyone holding its link.
    if (!trip || !trip.isPublished) throw new BookingError("Аялал олдсонгүй", 404);
    if (hasVariablePricing({ sourceMetadata: trip.sourceMetadata as Record<string, unknown> | null })) {
      throw new BookingError("Энэ аяллын үнэ буудал, огнооноос хамаарна. Үнийн санал авах хүсэлт илгээнэ үү", 409);
    }

    const prices = resolvePrices(trip, departure);
    if (hasMissingPassengerFare(input, prices)) {
      throw new BookingError("Хүүхэд эсвэл нярайн үнэ баталгаажаагүй байна. Ажилтнаас үнийн санал авна уу", 409);
    }

    const sellableStatus =
      departure.status !== "CANCELLED" &&
      departure.status !== "DEPARTED" &&
      departure.status !== "SOLD_OUT" &&
      departure.status !== "PAUSED";
    const inFuture = departure.startDate.getTime() > Date.now();

    if (!sellableStatus || !inFuture) {
      throw new BookingError("Энэ огноонд захиалга авах боломжгүй байна", 409);
    }

    // seatsLeft is the one number every surface in the app already reads —
    // TripCard, the departure picker, the departures calendar, staff's own
    // dashboard — and staff already decrement it by hand for phone sales.
    // Booking here has to decrement the *same* field, under the *same* row
    // lock, or the two channels silently oversell against each other: a
    // departure staff sold out by phone (seatsLeft = 0) but never flipped to
    // SOLD_OUT would otherwise still take online bookings, because nothing
    // online ever looked at seatsLeft at all before this. `null` still means
    // "no declared capacity" — unlimited, same convention as everywhere else.
    if (departure.seatsLeft !== null) {
      if (departure.seatsLeft < seats) {
        throw new BookingError(
          departure.seatsLeft === 0
            ? "Энэ огноо дүүрсэн байна"
            : `Энэ огноонд ${departure.seatsLeft} суудал үлдсэн байна`,
          409,
        );
      }

      await tx.departure.update({
        where: { id: departure.id },
        data: { seatsLeft: { decrement: seats } },
      });
    }

    const totalPrice = lineTotal(
      { adults: input.adults, children: input.children, infants: input.infants },
      prices,
    );

    const booking = await tx.booking.create({
      data: {
        reference: input.reference,
        tripId: input.tripId,
        departureId: input.departureId,
        status: "HELD",
        adults: input.adults,
        children: input.children,
        infants: input.infants,
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        phone: input.phone,
        email: input.email ?? null,
        notes: input.notes ?? null,
        totalPrice,
        depositDue: null,
        holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
        source: input.source ?? null,
        visitorId: input.visitorId ?? null,
        payments: {
          create: {
            method: "BANK",
            status: "PENDING",
            amount: totalPrice,
            reference: input.paymentReference,
          },
        },
      },
      include: { payments: true },
    });

    return Object.assign(booking, {
      duplicate: false,
      seatChange: await describeSeatChange(tx, departure.id, before),
    });
  }, SEAT_TRANSACTION), SEAT_RETRY);
}

/**
 * Confirm (or re-confirm, harmlessly) a QPay payment against its invoice.
 *
 * Shared by the webhook and the customer's status poll — neither trusts its
 * own trigger; both call this, and this is the only place that calls QPay's
 * `checkInvoice` and is allowed to mark a booking paid. A webhook firing
 * twice, or a poll racing the webhook, lands here twice and the second call
 * sees `status !== "PENDING"` and does nothing.
 *
 * Full payment only for now, matching the invoice this project creates —
 * QPay invoices are raised for a booking's whole outstanding balance, not a
 * partial deposit, so "paid" here always means paid in full.
 */
export async function confirmQpayInvoicePayment(invoiceId: string): Promise<{
  confirmed: boolean;
  bookingReference: string | null;
}> {
  const payment = await prisma.payment.findFirst({
    where: { providerRef: invoiceId, method: "QPAY" },
    select: { id: true, status: true, bookingId: true, booking: { select: { reference: true, totalPrice: true } } },
  });

  if (!payment) return { confirmed: false, bookingReference: null };
  if (payment.status === "PAID") {
    return { confirmed: true, bookingReference: payment.booking.reference };
  }

  const result = await checkInvoice(invoiceId);

  if (!result.paid) return { confirmed: false, bookingReference: payment.booking.reference };

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", paidAt: new Date(), providerRef: invoiceId },
    }),
    prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        paidAmount: payment.booking.totalPrice,
        status: "CONFIRMED",
        holdExpiresAt: null,
      },
    }),
  ]);

  return { confirmed: true, bookingReference: payment.booking.reference };
}

/**
 * Move a booking to another status with its seats following along: leaving a
 * seat-holding status gives the seats back, coming back to one takes them
 * again — refused with a 409 when the date has no room left, rather than
 * silently overselling it.
 *
 * The departure row is locked first, as createBooking does, then the booking
 * row, and its status is read under both locks. Two cancels sent at once, or
 * a payment recorded while the expiry sweep runs, move the seats exactly
 * once. (Reading the status before taking the lock let a double cancel give
 * the seats back twice, and let staff confirm a hold the sweep had just
 * released, leaving a confirmed booking with no seats behind it.)
 */
export async function setBookingStatus(
  bookingId: string,
  status: BookingStatus,
  { handledById, data = {} }: { handledById?: string; data?: { paidAmount?: number; notes?: string | null } } = {},
) {
  const found = await prisma.booking.findUnique({ where: { id: bookingId }, select: { departureId: true } });
  if (!found) throw new BookingError("Захиалга олдсонгүй", 404);

  return withPrismaRetry(() => prisma.$transaction(async (tx) => {
    const before = (await lockDeparture(tx, found.departureId))?.seatsLeft ?? null;
    const [current] = await tx.$queryRaw<{ status: BookingStatus; adults: number; children: number; infants: number }[]>`
      SELECT status, adults, children, infants FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
    if (!current) throw new BookingError("Захиалга олдсонгүй", 404);

    const seats = current.adults + current.children + current.infants;
    const releasing = HOLDING.has(current.status) && !HOLDING.has(status);
    const taking = !HOLDING.has(current.status) && HOLDING.has(status);

    if (taking && before !== null && before < seats) {
      throw new BookingError(
        before <= 0
          ? "Энэ огноонд суудал үлдээгүй тул захиалгыг сэргээх боломжгүй. Эхлээд аяллын суудлын тоог нэмнэ үү"
          : `Энэ огноонд ${before} суудал үлдсэн тул ${seats} хүний захиалгыг сэргээх боломжгүй`,
        409,
      );
    }
    if (releasing || taking) {
      await tx.departure.updateMany({
        where: { id: found.departureId, seatsLeft: { not: null } },
        data: { seatsLeft: releasing ? { increment: seats } : { decrement: seats } },
      });
    }

    // A settled or cancelled booking is no longer provisional; one put back
    // on hold gets a fresh hold window, or the sweep would expire it at once.
    const holdExpiresAt =
      status === "CONFIRMED" || status === "COMPLETED" || status === "CANCELLED"
        ? null
        : status === "HELD" && current.status !== "HELD"
          ? new Date(Date.now() + HOLD_MINUTES * 60_000)
          : undefined;

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        ...data,
        status,
        ...(handledById ? { handledById } : {}),
        ...(holdExpiresAt === undefined ? {} : { holdExpiresAt }),
      },
    });
    return Object.assign(updated, { seatChange: await describeSeatChange(tx, found.departureId, before) });
  }, SEAT_TRANSACTION), SEAT_RETRY);
}

/**
 * Cancel a booking, releasing its seats if it was holding any.
 *
 * Idempotent: cancelling an already-cancelled or already-expired booking is
 * a no-op rather than a double release. `handledById` is optional so the
 * same function covers a staff action (admin PATCH) and any future
 * system-initiated cancellation.
 */
export async function cancelBooking(bookingId: string, handledById?: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new BookingError("Захиалга олдсонгүй", 404);

  if (booking.status === "CANCELLED" || booking.status === "EXPIRED") {
    return Object.assign(booking, { seatChange: null });
  }

  // A cancel that races another one, or the expiry sweep, is settled under
  // the locks in setBookingStatus: the seats come back once.
  return setBookingStatus(bookingId, "CANCELLED", { handledById });
}

/**
 * Relabel holds that ran out and give their seats back: one date at a time,
 * each under its departure lock (see releaseExpiredHolds), so a hold that was
 * paid or cancelled while the sweep ran is never released a second time.
 * `tripId` limits the sweep to one trip (its booking panel is about to load).
 */
export async function expireStaleHolds(
  { tripId }: { tripId?: string } = {},
): Promise<{ expired: number; seatChanges: SeatChange[] }> {
  const due = await prisma.booking.findMany({
    where: { status: "HELD", holdExpiresAt: { lt: new Date() }, ...(tripId ? { tripId } : {}) },
    select: { departureId: true },
    distinct: ["departureId"],
  });

  let expired = 0;
  const seatChanges: SeatChange[] = [];
  for (const { departureId } of due) {
    const result = await withPrismaRetry(() => prisma.$transaction(async (tx) => {
      const before = (await lockDeparture(tx, departureId))?.seatsLeft ?? null;
      const holds = await releaseExpiredHolds(tx, departureId);
      return { holds, change: holds ? await describeSeatChange(tx, departureId, before) : null };
    }, SEAT_TRANSACTION), SEAT_RETRY);
    expired += result.holds;
    if (result.change) seatChanges.push(result.change);
  }

  return { expired, seatChanges };
}

/**
 * A customer opened a QPay invoice, so the booking now waits on that payment
 * (and no longer expires). Conditional: a hold the sweep has just expired stays
 * expired — its seats may already be someone else's — instead of being
 * reopened without them. Returns whether the booking is now waiting.
 */
export async function markAwaitingQpay(bookingId: string): Promise<boolean> {
  const { count } = await prisma.booking.updateMany({
    where: { id: bookingId, status: { in: ["HELD", "PENDING_PAYMENT"] } },
    data: { status: "PENDING_PAYMENT" },
  });
  return count === 1;
}
