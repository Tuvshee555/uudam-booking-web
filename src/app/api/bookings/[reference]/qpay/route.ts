import { prisma } from "@/server/prisma";
import { handler, httpError, json } from "@/server/http";
import { confirmQpayInvoicePayment } from "@/server/booking";
import { createInvoice, qpayConfigured } from "@/server/qpay";

type Ctx = { params: Promise<{ reference: string }> };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://uudamtravel.mn";

/**
 * POST /api/bookings/:reference/qpay — public. Creates (or reuses) a QPay
 * invoice for this booking's outstanding balance.
 *
 * A booking can be re-opened here any number of times before it expires —
 * a customer who closes the tab and comes back gets the same pending
 * invoice rather than a new one piling up in the merchant account.
 */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  if (!qpayConfigured()) throw httpError(503, "Онлайн төлбөр түр ажиллахгүй байна");

  const { reference } = await ctx.params;

  const booking = await prisma.booking.findUnique({
    where: { reference: reference.toUpperCase() },
    select: {
      id: true,
      status: true,
      totalPrice: true,
      paidAmount: true,
      trip: { select: { title: true } },
      payments: {
        where: { method: "QPAY", status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!booking) throw httpError(404, "Захиалга олдсонгүй");
  if (booking.status !== "HELD" && booking.status !== "PENDING_PAYMENT") {
    throw httpError(409, "Энэ захиалга төлбөр хүлээхгүй байна");
  }

  const balance = booking.totalPrice - booking.paidAmount;
  if (balance <= 0) throw httpError(409, "Энэ захиалга бүрэн төлөгдсөн байна");

  // Reuse an existing pending invoice rather than creating a fresh one on
  // every page load / retry.
  const existing = booking.payments[0];
  if (existing?.providerRef) {
    return json({ invoiceId: existing.providerRef, reused: true });
  }

  const invoice = await createInvoice({
    amount: balance,
    senderInvoiceNo: reference.toUpperCase(),
    description: `${booking.trip.title} — ${reference.toUpperCase()}`,
    callbackUrl: `${SITE_URL}/api/webhooks/qpay`,
  });

  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      method: "QPAY",
      status: "PENDING",
      amount: balance,
      reference: reference.toUpperCase(),
      provider: "qpay",
      providerRef: invoice.invoiceId,
    },
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "PENDING_PAYMENT" },
  });

  return json({
    invoiceId: invoice.invoiceId,
    qrText: invoice.qrText,
    qrImage: invoice.qrImage,
    deepLinks: invoice.deepLinks,
    reused: false,
  });
});

/**
 * GET /api/bookings/:reference/qpay — the customer's status poll while
 * waiting in their banking app. Always re-verifies with QPay directly
 * through confirmQpayInvoicePayment rather than reading our own PENDING
 * flag, so a payment that lands between polls is caught on the next one.
 */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { reference } = await ctx.params;

  const payment = await prisma.payment.findFirst({
    where: { booking: { reference: reference.toUpperCase() }, method: "QPAY" },
    orderBy: { createdAt: "desc" },
    select: { providerRef: true, status: true },
  });

  if (!payment?.providerRef) return json({ paid: false });
  if (payment.status === "PAID") return json({ paid: true });

  const result = await confirmQpayInvoicePayment(payment.providerRef);
  return json({ paid: result.confirmed });
});
