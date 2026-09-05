import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/prisma";
import { lineTotal, resolvePrices, totalHeadcount } from "@/lib/pricing";

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

/**
 * Seats already spoken for on a departure.
 *
 * Counts people, not bookings — infants included, because this is capacity
 * on a vehicle, and a departure's `seatsTotal` is a physical limit.
 */
export async function seatsTaken(
  departureId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<number> {
  const now = new Date();

  const rows = await tx.booking.findMany({
    where: {
      departureId,
      status: { in: [...SEAT_HOLDING_STATUSES] },
      // A HELD booking whose hold has lapsed is not holding anything, even if
      // the sweep hasn't relabelled it yet. Availability must not wait on a
      // background job to be correct.
      NOT: { status: "HELD", holdExpiresAt: { lt: now } },
    },
    select: { adults: true, children: true, infants: true },
  });

  return rows.reduce((sum, r) => sum + r.adults + r.children + r.infants, 0);
}

export type Availability = {
  /** Null when the departure has no declared capacity — unlimited. */
  capacity: number | null;
  taken: number;
  /** Null when capacity is null. */
  remaining: number | null;
  bookable: boolean;
};

export async function departureAvailability(
  departureId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<Availability | null> {
  const departure = await tx.departure.findUnique({
    where: { id: departureId },
    select: { seatsTotal: true, status: true, startDate: true },
  });

  if (!departure) return null;

  const taken = await seatsTaken(departureId, tx);
  const capacity = departure.seatsTotal;

  const sellableStatus =
    departure.status !== "CANCELLED" &&
    departure.status !== "DEPARTED" &&
    departure.status !== "SOLD_OUT";

  const inFuture = departure.startDate.getTime() > Date.now();
  const remaining = capacity === null ? null : Math.max(0, capacity - taken);

  return {
    capacity,
    taken,
    remaining,
    bookable: sellableStatus && inFuture && (remaining === null || remaining > 0),
  };
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
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
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

  return prisma.$transaction(async (tx) => {
    // Locks the departure row for the rest of this transaction. Without this,
    // "read how many seats are taken, then insert if there's room" is not
    // atomic under Postgres's default READ COMMITTED isolation: two
    // concurrent transactions can both read the same "0 taken" count before
    // either commits, and both insert. Verified directly — 5 simultaneous
    // requests against a 1-seat departure all succeeded before this line
    // existed. FOR UPDATE makes every other transaction booking this same
    // departure block here until this one commits or rolls back, so the next
    // one in line re-reads the true, post-commit count.
    await tx.$queryRaw`SELECT id FROM "Departure" WHERE id = ${input.departureId} FOR UPDATE`;

    const departure = await tx.departure.findUnique({
      where: { id: input.departureId },
      select: {
        id: true,
        tripId: true,
        price: true,
        childPrice: true,
        infantPrice: true,
      },
    });

    if (!departure || departure.tripId !== input.tripId) {
      throw new BookingError("Сонгосон огноо олдсонгүй", 404);
    }

    const trip = await tx.trip.findUnique({
      where: { id: input.tripId },
      select: {
        id: true,
        isPublished: true,
        price: true,
        childPrice: true,
        infantPrice: true,
      },
    });

    // An unpublished trip is a 404 here too, matching the storefront: a taken
    // down trip must not still be sellable to anyone holding its link.
    if (!trip || !trip.isPublished) throw new BookingError("Аялал олдсонгүй", 404);

    const availability = await departureAvailability(input.departureId, tx);
    if (!availability?.bookable) {
      throw new BookingError("Энэ огноонд захиалга авах боломжгүй байна", 409);
    }
    if (availability.remaining !== null && availability.remaining < seats) {
      throw new BookingError(
        availability.remaining === 0
          ? "Энэ огноо дүүрсэн байна"
          : `Энэ огноонд ${availability.remaining} суудал үлдсэн байна`,
        409,
      );
    }

    const prices = resolvePrices(trip, departure);
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

    return booking;
  }, {
    // Concurrent bookings for the same departure now queue on the FOR UPDATE
    // lock rather than racing, so a burst of simultaneous requests spends
    // real time waiting rather than failing instantly. Defaults (5s/2s) were
    // too tight for that queue to drain under a handful of concurrent
    // requests; still short enough to fail fast under genuine overload
    // rather than hang.
    timeout: 10_000,
    maxWait: 10_000,
  });
}

/**
 * Relabel holds that ran out. Availability already ignores lapsed holds, so
 * this is bookkeeping rather than correctness — it keeps the admin list
 * honest about which bookings are actually alive.
 */
export async function expireStaleHolds(): Promise<number> {
  const result = await prisma.booking.updateMany({
    where: { status: "HELD", holdExpiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });

  return result.count;
}
