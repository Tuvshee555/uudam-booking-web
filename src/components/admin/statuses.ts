/**
 * Every status the admin shows, worded for staff and colour-coded once.
 *
 * Colour carries one meaning everywhere: amber = waiting on us, sky = in
 * progress, green = done well, red = stopped, grey = closed history.
 */

export type Tone = "neutral" | "brand" | "info" | "success" | "warning" | "danger";

type StatusInfo = { label: string; tone: Tone; description: string };

export type EnquiryStatus = "NEW" | "CONTACTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
export type EnquiryKind = "TRIP" | "CUSTOM" | "GIFT";
export type BookingStatus =
  | "HELD"
  | "PENDING_PAYMENT"
  | "PARTIALLY_PAID"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

export const ENQUIRY_STATUSES: EnquiryStatus[] = ["NEW", "CONTACTED", "CONFIRMED", "COMPLETED", "CANCELLED"];

export const ENQUIRY_STATUS_INFO: Record<EnquiryStatus, StatusInfo> = {
  NEW: { label: "Шинэ", tone: "warning", description: "Хараахан холбогдоогүй. Залгах хэрэгтэй." },
  CONTACTED: { label: "Холбогдсон", tone: "info", description: "Ярьсан, шийдвэрийг нь хүлээж байна." },
  CONFIRMED: { label: "Баталгаажсан", tone: "success", description: "Аялалд явахаар тохиролцсон." },
  COMPLETED: { label: "Аялсан", tone: "neutral", description: "Аялал нь дууссан." },
  CANCELLED: { label: "Цуцалсан", tone: "danger", description: "Явахгүй болсон эсвэл хариу өгөөгүй." },
};

/** The one obvious next step from each status, offered as the main button. */
export const ENQUIRY_NEXT_STATUS: Partial<Record<EnquiryStatus, { status: EnquiryStatus; label: string }>> = {
  NEW: { status: "CONTACTED", label: "Холбогдсон гэж тэмдэглэх" },
  CONTACTED: { status: "CONFIRMED", label: "Баталгаажсан гэж тэмдэглэх" },
  CONFIRMED: { status: "COMPLETED", label: "Аялсан гэж тэмдэглэх" },
};

export const ENQUIRY_KINDS: EnquiryKind[] = ["TRIP", "CUSTOM", "GIFT"];

export const ENQUIRY_KIND_INFO: Record<EnquiryKind, { label: string; description: string }> = {
  TRIP: { label: "Аяллын хүсэлт", description: "Сайт дээрх тодорхой аялалд хүсэлт илгээсэн." },
  CUSTOM: { label: "Захиалгат аялал", description: "Огноо тохирохгүй, өөрийн хүссэн аяллыг асуусан." },
  GIFT: { label: "Бэлгийн эрх", description: "Бэлгийн эрхийн бичиг авахыг хүссэн." },
};

export const BOOKING_STATUSES: BookingStatus[] = [
  "HELD",
  "PENDING_PAYMENT",
  "PARTIALLY_PAID",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
];

export const BOOKING_STATUS_INFO: Record<BookingStatus, StatusInfo> = {
  HELD: {
    label: "Шилжүүлэг хүлээж байна",
    tone: "warning",
    description: "Суудлыг түр барьсан. Банкны шилжүүлэг хугацаандаа орохгүй бол суудал автоматаар суллагдана.",
  },
  PENDING_PAYMENT: {
    label: "QPay төлбөр хүлээж байна",
    tone: "warning",
    description: "Үйлчлүүлэгч QPay-ээр төлөх нэхэмжлэх үүсгэсэн. Төлбөр орвол өөрөө баталгаажна.",
  },
  PARTIALLY_PAID: { label: "Урьдчилгаа төлсөн", tone: "info", description: "Хэсэгчлэн төлсөн, үлдэгдэлтэй." },
  CONFIRMED: { label: "Баталгаажсан", tone: "success", description: "Төлбөр бүрэн орж баталгаажсан." },
  COMPLETED: { label: "Аялал дууссан", tone: "neutral", description: "Аялалдаа явж ирсэн." },
  CANCELLED: { label: "Цуцалсан", tone: "danger", description: "Цуцлагдсан, суудал нь буцаж зарагдана." },
  EXPIRED: { label: "Хугацаа дууссан", tone: "neutral", description: "Төлбөр ороогүй тул суудал суллагдсан." },
};

/** Bookings that still need someone to check the bank statement. */
export const BOOKING_AWAITING: BookingStatus[] = ["HELD", "PENDING_PAYMENT", "PARTIALLY_PAID"];

export const DEPARTURE_STATUS_INFO: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: "Захиалга авч байна", tone: "success" },
  ALMOST_FULL: { label: "Цөөн суудал", tone: "warning" },
  SOLD_OUT: { label: "Дүүрсэн", tone: "danger" },
  PAUSED: { label: "Түр зогссон", tone: "neutral" },
  CANCELLED: { label: "Цуцлагдсан", tone: "danger" },
  DEPARTED: { label: "Явсан", tone: "neutral" },
};
