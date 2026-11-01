/**
 * Calendar arithmetic for the departure calendar, always in Ulaanbaatar time.
 *
 * Mongolia has kept UTC+8 all year since 2017, so a fixed offset is exact.
 * Everything works on "YYYY-MM" / "YYYY-MM-DD" keys built from UTC dates:
 * the browser's own time zone never enters into it, so a visitor in Los
 * Angeles sees the same month and the same day cells as one in Ulaanbaatar.
 */

const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

export type MonthKey = string; // "2026-11"
export type DayKey = string; // "2026-11-07"

/** Today's date in Ulaanbaatar as "YYYY-MM-DD". */
export function ulaanbaatarDay(now: number | Date = Date.now()): DayKey {
  const time = typeof now === "number" ? now : now.getTime();
  return new Date(time + UB_OFFSET_MS).toISOString().slice(0, 10);
}

export function monthOf(day: DayKey): MonthKey {
  return day.slice(0, 7);
}

/** Month `delta` months away, rolling the year over in either direction. */
export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function compareMonths(a: MonthKey, b: MonthKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export type CalendarCell = { day: number; key: DayKey } | null;

/**
 * The cells of a Monday-first month grid: leading blanks, one cell per day
 * (28–31, leap years included), trailing blanks to complete the last week.
 */
export function monthGrid(month: MonthKey): CalendarCell[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const cells: CalendarCell[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells.push({ day, key: `${month}-${String(day).padStart(2, "0")}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const WEEKDAYS_MN = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];
const WEEKDAY_NAMES_MN = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

/** "2026 оны 11-р сар" */
export function monthTitle(month: MonthKey): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year} оны ${monthNumber}-р сар`;
}

/** "11-р сарын 7, Бямба" */
export function dayTitle(day: DayKey): string {
  const [year, month, date] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return `${month}-р сарын ${date}, ${WEEKDAY_NAMES_MN[weekday]}`;
}

/** "2026 оны 9-р сарын 20" for a moment in time, read in Ulaanbaatar. */
export function fullDateTitle(value: string | Date): string {
  const [year, month, day] = ulaanbaatarDay(new Date(value)).split("-").map(Number);
  return `${year} оны ${month}-р сарын ${day}`;
}

/** "11-р сар", with the year added when it is not this year's month. */
export function monthChipLabel(month: MonthKey, currentYear: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return year === currentYear ? `${monthNumber}-р сар` : `${year} · ${monthNumber}-р сар`;
}
