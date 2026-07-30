import { formatMnt } from "@/lib/pricing";

/**
 * Transactional email markup.
 *
 * Only two emails exist, because the site takes no money: a "we got your
 * request" note to the customer, and a heads-up to the office. Email clients
 * strip <style> blocks, so everything here is inline.
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
