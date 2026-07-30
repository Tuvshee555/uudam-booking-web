import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import {
  clientIp,
  handler,
  httpError,
  json,
  parsePositiveInt,
  rateLimit,
  readJson,
  safeText,
} from "@/server/http";
import { generateReference } from "@/server/reference";
import { sendEmail } from "@/server/mail";
import { enquiryReceivedEmail, enquiryStaffEmail } from "@/server/emailTemplates";
import { lineTotal, resolvePrices } from "@/lib/pricing";

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

/**
 * POST /api/enquiries — public "call me back" request.
 *
 * Open by design: requiring an account here would cost the agency the lead.
 * Rate limiting is the only gate.
 */
export const POST = handler(async (req: Request) => {
  rateLimit(`enquiry:${clientIp(req)}`, { windowMs: 60 * 60 * 1000, max: 12 });

  const body = await readJson(req);

  const firstName = safeText(body.firstName, 120);
  const phone = normalizePhone(body.phone);

  if (!firstName) throw httpError(400, "Нэрээ оруулна уу");
  if (!phone) throw httpError(400, "Утасны дугаараа зөв оруулна уу");

  const tripId = safeText(body.tripId, 60);
  const departureId = safeText(body.departureId, 60);

  const adults = count(body.adults, 1) || 1;
  const children = count(body.children);
  const infants = count(body.infants);

  // Look the trip up rather than trusting anything the form sent about it, so
  // the estimate staff see always matches the published catalogue.
  const trip = tripId
    ? await prisma.trip.findUnique({
        where: { id: tripId },
        select: {
          id: true,
          title: true,
          durationDays: true,
          price: true,
          childPrice: true,
          infantPrice: true,
          isPublished: true,
          departures: {
            select: {
              id: true,
              tripId: true,
              startDate: true,
              price: true,
              childPrice: true,
              infantPrice: true,
            },
          },
        },
      })
    : null;

  // A hidden trip reads as "not found" here too — the same rule as the direct
  // trip lookup, so a taken-down trip can't still take enquiries by its link.
  if (tripId && (!trip || !trip.isPublished)) throw httpError(400, "Аялал олдсонгүй");

  // A departure id belonging to a different trip is dropped rather than
  // trusted — it would put the wrong date in front of staff.
  const departure =
    trip && departureId ? (trip.departures.find((d) => d.id === departureId) ?? null) : null;

  const departureDate = departure?.startDate ?? null;

  const estimatedTotal = trip
    ? lineTotal({ adults, children, infants }, resolvePrices(trip, departure))
    : null;

  const enquiry = await prisma.enquiry.create({
    data: {
      reference: generateReference(),
      tripId: trip?.id ?? null,
      departureId: departure?.id ?? null,
      departureDate,
      firstName,
      lastName: safeText(body.lastName, 120),
      phone,
      email: safeText(body.email, 200)?.toLowerCase() ?? null,
      adults,
      children,
      infants,
      message: safeText(body.message, 2000),
      estimatedTotal,
      source: safeText(body.source, 120),
      visitorId: safeText(body.visitorId, 64),
      referrer: safeText(body.referrer, 200),
    },
    select: { id: true, reference: true },
  });

  // Notifications must never block the response — a customer should not see a
  // failure because SMTP was slow.
  after(async () => {
    const payload = {
      reference: enquiry.reference,
      firstName,
      lastName: safeText(body.lastName, 120),
      phone,
      email: safeText(body.email, 200),
      adults,
      children,
      infants,
      departureDate,
      message: safeText(body.message, 2000),
      estimatedTotal,
      trip: trip ? { title: trip.title, durationDays: trip.durationDays } : null,
    };

    const office = process.env.ENQUIRY_NOTIFY_EMAIL || process.env.SMTP_USER;

    if (office) {
      await sendEmail({
        to: office,
        subject: `Шинэ хүсэлт ${enquiry.reference} — ${trip?.title ?? "Аялал"}`,
        html: enquiryStaffEmail(payload),
      }).catch((err) => console.error("Staff enquiry email failed:", err));
    }

    const customerEmail = payload.email;
    if (customerEmail) {
      await sendEmail({
        to: customerEmail,
        subject: `Хүсэлт хүлээн авлаа — ${enquiry.reference}`,
        html: enquiryReceivedEmail(payload, process.env.NEXT_PUBLIC_PHONE ?? ""),
      }).catch((err) => console.error("Customer enquiry email failed:", err));
    }
  });

  return json({ ok: true, reference: enquiry.reference }, { status: 201 });
});

/** GET /api/enquiries — the staff work queue. */
export const GET = handler(async (req: Request) => {
  await requireAdmin(req);

  const url = new URL(req.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1, 100_000);
  const limit = parsePositiveInt(url.searchParams.get("limit"), 25, 100);
  const status = url.searchParams.get("status");
  const search = (url.searchParams.get("search") ?? "").trim();

  const VALID_STATUSES = new Set(["NEW", "CONTACTED", "CONFIRMED", "COMPLETED", "CANCELLED"]);
  if (status && status !== "ALL" && !VALID_STATUSES.has(status)) {
    throw httpError(400, "Статус буруу байна");
  }

  const where: Prisma.EnquiryWhereInput = {
    ...(status && status !== "ALL"
      ? { status: status as Prisma.EnumEnquiryStatusFilter["equals"] }
      : {}),
    ...(search
      ? {
          OR: [
            { reference: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, enquiries, newCount] = await Promise.all([
    prisma.enquiry.count({ where }),
    prisma.enquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        trip: { select: { id: true, slug: true, title: true, image: true } },
        departure: { select: { id: true, startDate: true, label: true } },
      },
    }),
    prisma.enquiry.count({ where: { status: "NEW" } }),
  ]);

  return json({
    enquiries,
    newCount,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});
