/**
 * Plain-Mongolian formatting for the admin panel.
 *
 * Written by hand on purpose: browsers ship no Mongolian ICU data, so
 * `toLocaleDateString("mn-MN")` prints English month names in the browser
 * while the server prints Mongolian. Kept free of "@/" imports so the node
 * tests can load it directly.
 */

const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function toDate(value: string | Date): Date {
  return typeof value === "string" ? new Date(value) : value;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

/** "1,234,567" — separators keep long numbers readable at a glance. */
export function formatNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return NUMBER.format(Math.round(value));
}

/** "2,450,000₮". A missing amount is a dash, never "0₮", which would read as free. */
export function formatMoney(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${NUMBER.format(Math.round(value))}₮`;
}

/** "10-р сарын 30", with the year only when it isn't the current one. */
export function formatDate(value: string | Date, now = new Date()): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  const label = `${date.getMonth() + 1}-р сарын ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? label : `${date.getFullYear()} оны ${label}`;
}

/** "2026 оны 9-р сар" — for things known only to the month, like when someone travelled. */
export function formatMonthYear(value: string | Date): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()} оны ${date.getMonth() + 1}-р сар`;
}

/** "10-р сарын 30, 14:05". */
export function formatDateTime(value: string | Date, now = new Date()): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(date, now)}, ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

/** "10-р сарын 30, Пүрэв гараг" — the dashboard's date line. */
export function formatToday(now = new Date()): string {
  return `${now.getMonth() + 1}-р сарын ${now.getDate()}, ${WEEKDAYS[now.getDay()]} гараг`;
}

/** "Дөнгөж сая", "5 минутын өмнө", "Өчигдөр 14:05", then a plain date. */
export function formatRelative(value: string | Date, now = new Date()): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = now.getTime() - date.getTime();

  if (diff < 0) return formatDateTime(date, now);
  if (diff < MINUTE) return "Дөнгөж сая";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} минутын өмнө`;
  if (sameDay(date, now)) return `${Math.floor(diff / HOUR)} цагийн өмнө`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return `Өчигдөр ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;

  if (diff < 7 * DAY) return `${Math.max(2, Math.round(diff / DAY))} өдрийн өмнө`;
  return formatDate(date, now);
}

/** Time left before a deadline: "38 мин", "1 цаг 5 мин". Null once it has passed. */
export function formatTimeLeft(value: string | Date, now = new Date()): string | null {
  const diff = toDate(value).getTime() - now.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return null;
  const minutes = Math.max(1, Math.ceil(diff / MINUTE));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} цаг ${rest} мин` : `${hours} цаг`;
  return `${Math.floor(hours / 24)} өдөр`;
}

/** A "2026-11-05" calendar-day key as local midnight, so it formats as that same day. */
export function dateFromKey(key: string): Date {
  const [year, month, day] = key.slice(0, 10).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/** Whole calendar days from today until a date: 0 today, 1 tomorrow, negative if past. */
export function daysUntil(value: string | Date, now = new Date()): number {
  const date = toDate(value);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((target.getTime() - start.getTime()) / DAY);
}

/** "Өнөөдөр", "Маргааш", "5 хоногийн дараа" — next to an upcoming date. */
export function formatDaysUntil(value: string | Date, now = new Date()): string {
  const days = daysUntil(value, now);
  if (days < 0) return "Өнгөрсөн";
  if (days === 0) return "Өнөөдөр";
  if (days === 1) return "Маргааш";
  return `${days} хоногийн дараа`;
}

export type PeopleCount = { adults: number; children: number; infants: number };

/** "2 том хүн, 1 хүүхэд" — every group spelled out, zeros left out. */
export function formatPeople({ adults, children, infants }: PeopleCount): string {
  const parts = [
    adults ? `${adults} том хүн` : null,
    children ? `${children} хүүхэд` : null,
    infants ? `${infants} нярай` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "0 хүн";
}

export function totalPeople({ adults, children, infants }: PeopleCount): number {
  return adults + children + infants;
}

/** A tel: link that dials the number as typed, minus spaces and dashes. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** "Бат Дорж", falling back to whatever single name was given. */
export function fullName(first: string | null | undefined, last?: string | null): string {
  return [first, last].map((part) => part?.trim()).filter(Boolean).join(" ") || "Нэргүй";
}

/** Percent change against a previous period, or null when there is nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** "2 мин 14 сек"; under a second is a dash, since it means nobody read the page. */
export function formatDuration(ms: number): string {
  if (!ms || ms < 1000) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} сек`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} мин ${seconds % 60} сек`;
}
