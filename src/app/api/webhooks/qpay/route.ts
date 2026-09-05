import { NextResponse } from "next/server";

import { confirmQpayInvoicePayment } from "@/server/booking";
import { sendEmail } from "@/server/mail";
import { bookingCustomerEmail, bookingStaffEmail } from "@/server/emailTemplates";
import { prisma } from "@/server/prisma";

/**
 * POST /api/webhooks/qpay — QPay's payment notification.
 *
 * Its body is never trusted for the actual payment decision: QPay's own
 * webhook payload is deliberately not read here for status, because
 * anyone can POST to a public URL claiming anything. All this does is take
 * the invoice id and ask `confirmQpayInvoicePayment` to independently
 * re-verify with QPay's own /payment/check before marking anything paid —
 * the same function the customer's status poll calls, so there is exactly
 * one path in the codebase that can turn a booking into CONFIRMED.
 *
 * Always responds 200: QPay retries a non-2xx callback, and a booking this
 * webhook can't identify is not something retrying will fix.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);

    const invoiceId =
      typeof body.object_id === "string"
        ? body.object_id
        : typeof body.invoice_id === "string"
          ? body.invoice_id
          : null;

    if (!invoiceId) return NextResponse.json({ ok: true });

    const result = await confirmQpayInvoicePayment(invoiceId);

    if (result.confirmed && result.bookingReference) {
      const booking = await prisma.booking.findUnique({
        where: { reference: result.bookingReference },
        select: {
          reference: true,
          firstName: true,
          phone: true,
          email: true,
          adults: true,
          children: true,
          infants: true,
          totalPrice: true,
          trip: { select: { title: true } },
          departure: { select: { startDate: true } },
        },
      });

      if (booking) {
        const payload = {
          reference: booking.reference,
          firstName: booking.firstName,
          phone: booking.phone,
          email: booking.email,
          adults: booking.adults,
          children: booking.children,
          infants: booking.infants,
          totalPrice: booking.totalPrice,
          tripTitle: booking.trip.title,
          departureDate: booking.departure.startDate,
        };

        const office = process.env.ENQUIRY_NOTIFY_EMAIL || process.env.SMTP_USER;
        if (office) {
          await sendEmail({
            to: office,
            subject: `Төлбөр орлоо · ${booking.reference}`,
            html: bookingStaffEmail(payload),
          }).catch((err) => console.error("QPay staff notify email failed:", err));
        }

        if (booking.email) {
          await sendEmail({
            to: booking.email,
            subject: `Захиалга баталгаажлаа · ${booking.reference}`,
            html: bookingCustomerEmail(payload),
          }).catch((err) => console.error("QPay customer notify email failed:", err));
        }
      }
    }
  } catch (err) {
    // A crash here must not become a QPay retry storm; log and still 200.
    console.error("QPay webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}
