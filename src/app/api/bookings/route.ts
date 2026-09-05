import { after } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import {
  clientIp,
  handler,
  httpError,
  json,
  rateLimit,
  readJson,
  safeText,
} from "@/server/http";
import { generateReference } from "@/server/reference";
import { BookingError, createBooking, expireStaleHolds } from "@/server/booking";
import { sendEmail } from "@/server/mail";
import { bookingCustomerEmail, bookingStaffEmail } from "@/server/emailTemplates";

/** Mongolian mobile numbers are 8 digits; allow a country code and separators. */
function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[^\d+]/g, "");
  const bare = digits.replace(/^\+?976/, "");
  if (bare.length < 6 || bare.length > 15) return null;
  return digits.slice(0, 20);
}

function count(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, 99);
}

/** GET /api/bookings — staff list. */
export const GET = handler(async (req: Request) => {
  await requireAdmin(req);

  // Cheap and keeps the list honest without a cron: anything whose hold ran
  // out is relabelled before staff see it.
  await expireStaleHolds();

  const status = new URL(req.url).searchParams.get("status");

  const bookings = await prisma.booking.findMany({
    where: status ? { status: status as never } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      trip: { select: { id: true, title: true, image: true, slug: true } },
      departure: { select: { id: true, startDate: true, endDate: true } },
      payments: { orderBy: { createdAt: "asc" } },
      travelers: true,
    },
  });

  return json(bookings);
});

/**
 * POST /api/bookings — public. Creates a booking and holds the seats.
 *
 * Open by design, like the enquiry endpoint: requiring an account here would
 * cost the agency the sale. Rate limiting is the gate.
 */
export const POST = handler(async (req: Request) => {
  rateLimit(`booking:${clientIp(req)}`, { windowMs: 60 * 60 * 1000, max: 10 });

  const body = await readJson(req);

  const firstName = safeText(body.firstName, 120);
  const phone = normalizePhone(body.phone);
  const tripId = safeText(body.tripId, 60);
  const departureId = safeText(body.departureId, 60);

  if (!firstName) throw httpError(400, "Нэрээ оруулна уу");
  if (!phone) throw httpError(400, "Утасны дугаараа зөв оруулна уу");
  if (!tripId || !departureId) throw httpError(400, "Аялал болон огноо сонгоно уу");

  const reference = generateReference().replace("UUD-", "UUD-B-");

  try {
    const booking = await createBooking({
      tripId,
      departureId,
      adults: count(body.adults, 1) || 1,
      children: count(body.children),
      infants: count(body.infants),
      firstName,
      lastName: safeText(body.lastName, 120),
      phone,
      email: safeText(body.email, 200)?.toLowerCase() ?? null,
      notes: safeText(body.notes, 2000),
      source: safeText(body.source, 120),
      visitorId: safeText(body.visitorId, 64),
      reference,
      paymentReference: reference,
    });

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { title: true },
    });

    const departure = await prisma.departure.findUnique({
      where: { id: departureId },
      select: { startDate: true },
    });

    // Notifications must never block the response — a customer should not see
    // a failure because SMTP was slow.
    const settings = await prisma.siteSettings.findUnique({
      where: { id: "default" },
      select: { bankDetails: true },
    });

    after(async () => {
      const payload = {
        reference: booking.reference,
        firstName,
        phone,
        email: safeText(body.email, 200),
        adults: booking.adults,
        children: booking.children,
        infants: booking.infants,
        totalPrice: booking.totalPrice,
        tripTitle: trip?.title ?? "Аялал",
        departureDate: departure?.startDate ?? null,
        bankDetails: settings?.bankDetails ?? null,
      };

      const office = process.env.ENQUIRY_NOTIFY_EMAIL || process.env.SMTP_USER;
      if (office) {
        await sendEmail({
          to: office,
          subject: `Шинэ захиалга ${booking.reference} — ${payload.tripTitle}`,
          html: bookingStaffEmail(payload),
        }).catch((err) => console.error("Staff booking email failed:", err));
      }

      const customerEmail = safeText(body.email, 200);
      if (customerEmail) {
        await sendEmail({
          to: customerEmail,
          subject: `Захиалга ${booking.reference} — Uudam Travel`,
          html: bookingCustomerEmail(payload),
        }).catch((err) => console.error("Customer booking email failed:", err));
      }
    });

    return json(
      {
        reference: booking.reference,
        status: booking.status,
        totalPrice: booking.totalPrice,
        holdExpiresAt: booking.holdExpiresAt,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof BookingError) throw httpError(err.status, err.message);

    // P2028 ("Transaction API error") is what a booking transaction throws
    // under real contention on this exact departure/seat row — verified by
    // firing 5 concurrent requests at a 1-seat departure: exactly one booking
    // was created, no overselling, but the other four split between a clean
    // 409 and this raw error surfacing as an opaque 500. Same outcome
    // (someone else's request got there first), same customer-facing
    // message, just without the stack trace.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2028" || err.code === "P2034")
    ) {
      throw httpError(409, "Энэ мөчид өөр хэрэглэгч захиалга хийж байна. Дахин оролдоно уу");
    }

    throw err;
  }
});
