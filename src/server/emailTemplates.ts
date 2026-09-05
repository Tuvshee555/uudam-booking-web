import { formatMnt } from "@/lib/pricing";

/**
 * Transactional email markup.
 *
 * Enquiries send a "we got your request" note plus an office heads-up;
 * bookings add their own pair carrying the reference the customer must quote
 * on their bank transfer. Email clients strip <style> blocks, so everything
 * here is inline.
 */

const NAVY = "#113e67";
const GOLD = "#f2bd4a";
const AGENCY = "Uudam Travel Agency";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(date?: Date | string | null) {
  if (!date) return "Тодруулаагүй";
  return new Date(date).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function shell(title: string, body: string) {
  return `
<div style="margin:0;padding:24px 12px;background:#f4f6f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:${NAVY};padding:22px 26px;">
      <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.4px;">UUDAM</div>
      <div style="color:${GOLD};font-size:11px;letter-spacing:2.4px;text-transform:uppercase;margin-top:3px;">Travel Agency</div>
    </div>
    <div style="padding:26px;">
      <h1 style="margin:0 0 14px;font-size:19px;line-height:1.35;color:${NAVY};">${escapeHtml(title)}</h1>
      ${body}
    </div>
    <div style="padding:16px 26px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
      ${AGENCY}
    </div>
  </div>
</div>`.trim();
}

function row(label: string, value: string) {
  return `
  <div style="display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #eef2f7;font-size:14px;">
    <span style="color:#64748b;">${escapeHtml(label)}</span>
    <strong style="color:#0f172a;text-align:right;">${escapeHtml(value)}</strong>
  </div>`;
}

export type EnquiryEmailData = {
  reference: string;
  firstName: string;
  lastName?: string | null;
  phone: string;
  email?: string | null;
  adults: number;
  children: number;
  infants: number;
  departureDate?: Date | string | null;
  message?: string | null;
  estimatedTotal?: number | null;
  trip?: { title: string; durationDays: number } | null;
};

function passengers(enquiry: EnquiryEmailData) {
  return (
    [
      enquiry.adults ? `${enquiry.adults} том хүн` : null,
      enquiry.children ? `${enquiry.children} хүүхэд` : null,
      enquiry.infants ? `${enquiry.infants} нярай` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "—"
  );
}

/** Sent to the customer, if they left an address. */
export function enquiryReceivedEmail(enquiry: EnquiryEmailData, phone: string) {
  return shell(
    `${escapeHtml(enquiry.firstName)}, хүсэлтийг тань хүлээн авлаа 🧳`,
    `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569;">
      Манай ажилтан удахгүй тантай холбогдож, аяллын дэлгэрэнгүй мэдээлэл болон
      эцсийн үнийг тодруулна. Яаралтай бол <strong>${escapeHtml(phone)}</strong>
      дугаарт залгаарай.
    </p>
    <div>
      ${row("Хүсэлтийн дугаар", enquiry.reference)}
      ${enquiry.trip ? row("Аялал", enquiry.trip.title) : ""}
      ${row("Хөдлөх огноо", formatDate(enquiry.departureDate))}
      ${row("Хүний тоо", passengers(enquiry))}
      ${
        typeof enquiry.estimatedTotal === "number"
          ? row("Ойролцоо дүн", formatMnt(enquiry.estimatedTotal))
          : ""
      }
    </div>
    <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;">
      Ойролцоо дүн нь нийтлэгдсэн үнэ дээр тооцсон урьдчилсан тооцоо бөгөөд
      эцсийн үнэ биш болно.
    </p>`,
  );
}

/** Sent to the office so nobody has to watch the admin panel all day. */
export function enquiryStaffEmail(enquiry: EnquiryEmailData) {
  const name = [enquiry.firstName, enquiry.lastName].filter(Boolean).join(" ");

  return shell(
    `Шинэ хүсэлт — ${enquiry.reference}`,
    `
    <div>
      ${row("Нэр", name)}
      ${row("Утас", enquiry.phone)}
      ${enquiry.email ? row("И-мэйл", enquiry.email) : ""}
      ${enquiry.trip ? row("Аялал", enquiry.trip.title) : row("Аялал", "Тодорхойгүй")}
      ${row("Хөдлөх огноо", formatDate(enquiry.departureDate))}
      ${row("Хүний тоо", passengers(enquiry))}
      ${
        typeof enquiry.estimatedTotal === "number"
          ? row("Ойролцоо дүн", formatMnt(enquiry.estimatedTotal))
          : ""
      }
    </div>
    ${
      enquiry.message
        ? `<div style="margin-top:16px;padding:14px;background:#f8fafc;border-left:3px solid ${GOLD};border-radius:8px;font-size:14px;line-height:1.6;color:#475569;">
             ${escapeHtml(enquiry.message)}
           </div>`
        : ""
    }
    <p style="margin:18px 0 0;font-size:13px;">
      <a href="${escapeHtml(enquiry.phone.replace(/[^\d+]/g, "") ? `tel:${enquiry.phone.replace(/[^\d+]/g, "")}` : "#")}"
         style="display:inline-block;background:${NAVY};color:#fff;text-decoration:none;padding:11px 20px;border-radius:9px;font-weight:700;">
        Залгах
      </a>
    </p>`,
  );
}

export function passwordResetEmail(resetUrl: string) {
  return shell(
    "Нууц үг сэргээх",
    `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569;">
      Доорх товчийг дарж шинэ нууц үг тохируулна уу. Холбоос 15 минутын дараа
      хүчингүй болно.
    </p>
    <a href="${escapeHtml(resetUrl)}"
       style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:14px;">
      Нууц үг солих
    </a>
    <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">${escapeHtml(resetUrl)}</p>`,
  );
}


export type BookingEmailPayload = {
  reference: string;
  firstName: string;
  phone: string;
  email?: string | null;
  adults: number;
  children: number;
  infants: number;
  totalPrice: number;
  tripTitle: string;
  departureDate?: Date | string | null;
  bankDetails?: string | null;
};

function travellerLine(p: BookingEmailPayload) {
  return [
    `${p.adults} том хүн`,
    p.children ? `${p.children} хүүхэд` : null,
    p.infants ? `${p.infants} нярай` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * The customer's copy. Leads with the reference, because that is the one
 * thing they must put on the transfer for staff to match the payment.
 */
export function bookingCustomerEmail(p: BookingEmailPayload) {
  return shell(
    "Захиалга баталгаажлаа",
    `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569;">
      Сайн байна уу, ${escapeHtml(p.firstName)}. Таны захиалгыг хүлээн авлаа.
      Суудлыг түр барьж байна — төлбөр хийсний дараа ажилтан баталгаажуулна.
    </p>

    <div style="padding:16px;background:#f8fafc;border-radius:10px;">
      <p style="margin:0;font-size:12px;color:#64748b;">Захиалгын дугаар</p>
      <p style="margin:4px 0 0;font-size:22px;font-weight:800;letter-spacing:2px;color:${NAVY};">
        ${escapeHtml(p.reference)}
      </p>
    </div>

    <table style="width:100%;margin-top:18px;font-size:14px;color:#475569;border-collapse:collapse;">
      <tr><td style="padding:6px 0;">Аялал</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;">${escapeHtml(p.tripTitle)}</td></tr>
      <tr><td style="padding:6px 0;">Хөдлөх огноо</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;">${formatDate(p.departureDate)}</td></tr>
      <tr><td style="padding:6px 0;">Хүн</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;">${escapeHtml(travellerLine(p))}</td></tr>
      <tr><td style="padding:10px 0 0;border-top:1px solid #e2e8f0;">Нийт дүн</td><td style="padding:10px 0 0;border-top:1px solid #e2e8f0;text-align:right;font-weight:800;font-size:16px;color:${NAVY};">${formatMnt(p.totalPrice)}</td></tr>
    </table>

    ${
      p.bankDetails
        ? `<div style="margin-top:18px;padding:14px;background:#fffbeb;border-left:3px solid ${GOLD};border-radius:8px;font-size:14px;line-height:1.7;color:#475569;white-space:pre-line;">
             <strong style="color:#0f172a;">Шилжүүлэг хийх данс</strong>
             ${escapeHtml(p.bankDetails)}
             <br><br>
             Гүйлгээний утга дээр <strong>${escapeHtml(p.reference)}</strong> гэж бичнэ үү.
           </div>`
        : `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#475569;">
             Төлбөрийн мэдээллийг ажилтан тантай холбогдож хэлнэ.
           </p>`
    }`,
  );
}

/** The office copy — everything staff need to ring the customer back. */
export function bookingStaffEmail(p: BookingEmailPayload) {
  return shell(
    `Шинэ захиалга · ${escapeHtml(p.reference)}`,
    `
    <table style="width:100%;font-size:14px;color:#475569;border-collapse:collapse;">
      <tr><td style="padding:6px 0;">Аялал</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;">${escapeHtml(p.tripTitle)}</td></tr>
      <tr><td style="padding:6px 0;">Огноо</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;">${formatDate(p.departureDate)}</td></tr>
      <tr><td style="padding:6px 0;">Захиалагч</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;">${escapeHtml(p.firstName)}</td></tr>
      <tr><td style="padding:6px 0;">Утас</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;">${escapeHtml(p.phone)}</td></tr>
      <tr><td style="padding:6px 0;">Хүн</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;">${escapeHtml(travellerLine(p))}</td></tr>
      <tr><td style="padding:10px 0 0;border-top:1px solid #e2e8f0;">Нийт дүн</td><td style="padding:10px 0 0;border-top:1px solid #e2e8f0;text-align:right;font-weight:800;font-size:16px;color:${NAVY};">${formatMnt(p.totalPrice)}</td></tr>
    </table>

    <p style="margin:18px 0 0;font-size:13px;">
      <a href="tel:${escapeHtml(p.phone.replace(/[^\d+]/g, ""))}"
         style="display:inline-block;background:${NAVY};color:#fff;text-decoration:none;padding:11px 20px;border-radius:9px;font-weight:700;">
        Залгах
      </a>
    </p>`,
  );
}
