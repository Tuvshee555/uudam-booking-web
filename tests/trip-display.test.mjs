import assert from "node:assert/strict";
import test from "node:test";

import { formatCategoryName, formatTripDuration, formatTripTitle } from "../src/lib/tripDisplay.ts";

test("trip length reads 'N өдөр M шөнө' everywhere, with the trip's own nights", () => {
  assert.equal(formatTripDuration(9, 8), "9 өдөр 8 шөнө");
  assert.equal(formatTripDuration(9, 7), "9 өдөр 7 шөнө", "nights are never worked out from the days");
  assert.equal(formatTripDuration(1, 0), "1 өдөр");
  assert.equal(formatTripDuration(5), "5 өдөр");
  assert.equal(formatTripDuration(0, 0), "", "an unknown length is not '0 өдөр'");
  assert.equal(formatTripDuration(Number.NaN, 3), "");
});

test("titles lose the spaces typed just inside brackets", () => {
  assert.equal(formatTripTitle("Шанхай + Тэнгэрийн хаалга шууд нислэгтэй аялал ( Жанжиажэ – Аватар )"), "Шанхай + Тэнгэрийн хаалга шууд нислэгтэй аялал (Жанжиажэ – Аватар)");
  assert.equal(formatTripTitle("Хайнан [ 7 хоног ]"), "Хайнан [7 хоног]");
  assert.equal(formatTripTitle("Бээжин (5 өдөр)"), "Бээжин (5 өдөр)");
});

test("titles keep one dash style and single spaces", () => {
  assert.equal(formatTripTitle("Бээжин -- Жинин"), "Бээжин – Жинин");
  assert.equal(formatTripTitle("Бээжин - Жинин  —  Эрээн"), "Бээжин – Жинин – Эрээн");
  assert.equal(formatTripTitle("  ЕГИПЕТ шууд нислэгтэй аялал "), "ЕГИПЕТ шууд нислэгтэй аялал");
});

test("category names start with a capital for display", () => {
  assert.equal(formatCategoryName("газар + нислэг хосолсон"), "Газар + нислэг хосолсон");
  assert.equal(formatCategoryName("  "), "");
});
