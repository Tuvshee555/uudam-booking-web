import assert from "node:assert/strict";
import test from "node:test";

import { saleBadgeLabel } from "../src/lib/tripMarketing.ts";

const trip = (badge, discount = 0) => ({ discount, sourceMetadata: { marketingBadge: badge } });
// 2026-10-14 05:00 in Ulaanbaatar (UTC+8)
const day = (iso) => new Date(`${iso}T05:00:00+08:00`);

test("a sale badge with no end date stays on", () => {
  assert.equal(saleBadgeLabel(trip({ saleEnabled: true, saleLabel: "ХЯМДРАЛ" }), day("2026-10-14")), "ХЯМДРАЛ");
});

test("the badge shows through the last day of the sale", () => {
  const sale = trip({ saleEnabled: true, saleLabel: "ХЯМДРАЛ", saleEndsAt: "2026-10-14" });
  assert.equal(saleBadgeLabel(sale, day("2026-10-13")), "ХЯМДРАЛ");
  assert.equal(saleBadgeLabel(sale, day("2026-10-14")), "ХЯМДРАЛ");
});

test("the badge disappears the day after the sale ends", () => {
  const sale = trip({ saleEnabled: true, saleLabel: "ХЯМДРАЛ", saleEndsAt: "2026-10-01" });
  assert.equal(saleBadgeLabel(sale, day("2026-10-14")), null);
});

test("an ended sale falls back to a real percentage discount, never to the old label", () => {
  const sale = trip({ saleEnabled: true, saleLabel: "ХЯМДРАЛ", saleEndsAt: "2026-10-01" }, 10);
  assert.equal(saleBadgeLabel(sale, day("2026-10-14")), "-10%");
});

test("the end date is judged in Ulaanbaatar time, not the viewer's", () => {
  const sale = trip({ saleEnabled: true, saleLabel: "ХЯМДРАЛ", saleEndsAt: "2026-10-14" });
  // 23:30 on the 14th in Ulaanbaatar is still the 14th, though it is 15:30 UTC.
  assert.equal(saleBadgeLabel(sale, new Date("2026-10-14T23:30:00+08:00")), "ХЯМДРАЛ");
  assert.equal(saleBadgeLabel(sale, new Date("2026-10-15T00:30:00+08:00")), null);
});

test("a switched-off badge never shows", () => {
  assert.equal(saleBadgeLabel(trip({ saleEnabled: false, saleLabel: "ХЯМДРАЛ", saleEndsAt: "2099-01-01" }), day("2026-10-14")), null);
});
