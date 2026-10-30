import assert from "node:assert/strict";
import test from "node:test";
import {
  daysUntil,
  formatDate,
  formatDateTime,
  formatDaysUntil,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPeople,
  formatRelative,
  formatTimeLeft,
  formatToday,
  fullName,
  percentChange,
  telHref,
} from "../src/lib/adminFormat.ts";

// Local-time constructors, so the assertions hold in any timezone.
const now = new Date(2026, 9, 30, 15, 0, 0);

test("money and numbers are grouped, and a missing amount never reads as free", () => {
  assert.equal(formatNumber(1234567), "1,234,567");
  assert.equal(formatMoney(2450000), "2,450,000₮");
  assert.equal(formatMoney(null), "—");
  assert.equal(formatMoney(Number.NaN), "—");
});

test("dates are Mongolian and show the year only when it differs", () => {
  assert.equal(formatDate(new Date(2026, 9, 5), now), "10-р сарын 5");
  assert.equal(formatDate(new Date(2025, 0, 2), now), "2025 оны 1-р сарын 2");
  assert.equal(formatDateTime(new Date(2026, 9, 5, 9, 7), now), "10-р сарын 5, 09:07");
  assert.equal(formatDate("not a date", now), "—");
  assert.equal(formatToday(now), "10-р сарын 30, Баасан гараг");
});

test("relative times read like a person would say them", () => {
  assert.equal(formatRelative(new Date(2026, 9, 30, 14, 59, 40), now), "Дөнгөж сая");
  assert.equal(formatRelative(new Date(2026, 9, 30, 14, 35), now), "25 минутын өмнө");
  assert.equal(formatRelative(new Date(2026, 9, 30, 9, 0), now), "6 цагийн өмнө");
  assert.equal(formatRelative(new Date(2026, 9, 29, 20, 5), now), "Өчигдөр 20:05");
  assert.equal(formatRelative(new Date(2026, 9, 26, 12, 0), now), "4 өдрийн өмнө");
  assert.equal(formatRelative(new Date(2026, 8, 1, 12, 0), now), "9-р сарын 1");
});

test("time left counts down and disappears once the deadline passes", () => {
  assert.equal(formatTimeLeft(new Date(2026, 9, 30, 15, 38), now), "38 мин");
  assert.equal(formatTimeLeft(new Date(2026, 9, 30, 16, 5), now), "1 цаг 5 мин");
  assert.equal(formatTimeLeft(new Date(2026, 9, 30, 17, 0), now), "2 цаг");
  assert.equal(formatTimeLeft(new Date(2026, 9, 30, 14, 0), now), null);
});

test("days until an upcoming date", () => {
  assert.equal(daysUntil(new Date(2026, 9, 30, 23, 0), now), 0);
  assert.equal(formatDaysUntil(new Date(2026, 9, 31, 8, 0), now), "Маргааш");
  assert.equal(formatDaysUntil(new Date(2026, 10, 4), now), "5 хоногийн дараа");
  assert.equal(formatDaysUntil(new Date(2026, 9, 1), now), "Өнгөрсөн");
});

test("people, names, phone links, trends and durations", () => {
  assert.equal(formatPeople({ adults: 2, children: 1, infants: 0 }), "2 том хүн, 1 хүүхэд");
  assert.equal(formatPeople({ adults: 0, children: 0, infants: 0 }), "0 хүн");
  assert.equal(fullName("Бат", " Дорж "), "Бат Дорж");
  assert.equal(fullName("", null), "Нэргүй");
  assert.equal(telHref("+976 9911-2233"), "tel:+97699112233");
  assert.equal(percentChange(120, 100), 20);
  assert.equal(percentChange(5, 0), null);
  assert.equal(formatDuration(500), "—");
  assert.equal(formatDuration(134_000), "2 мин 14 сек");
});
