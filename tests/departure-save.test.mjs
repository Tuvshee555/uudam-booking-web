import assert from "node:assert/strict";
import test from "node:test";
import { saveDepartures } from "../src/server/saveDepartures.ts";

test("marking one date full keeps both departure IDs and the other date open", async () => {
  const rows = [
    { id: "first", startDate: new Date("2027-10-07T16:00:00Z"), status: "OPEN" },
    { id: "second", startDate: new Date("2027-10-15"), status: "OPEN" },
  ];
  let removal;
  const tx = { departure: {
    findMany: async () => rows,
    update: async ({ where, data }) => Object.assign(rows.find((row) => row.id === where.id), data),
    create: async () => { throw new Error("Existing dates must not be recreated"); },
    updateMany: async ({ where, data }) => rows.filter((row) => !where.id.notIn.includes(row.id)).forEach((row) => Object.assign(row, data)),
    deleteMany: async (query) => { removal = query; },
  } };
  await saveDepartures(tx, "trip", [
    { startDate: new Date("2027-10-08"), status: "SOLD_OUT", seatsLeft: 0 },
    { startDate: new Date("2027-10-15"), status: "OPEN", seatsLeft: 40 },
  ]);
  assert.deepEqual(rows.map((row) => [row.id, row.status]), [["first", "SOLD_OUT"], ["second", "OPEN"]]);
  assert.deepEqual(removal.where.bookings, { none: {} });
  assert.deepEqual(removal.where.enquiries, { none: {} });
  await saveDepartures(tx, "trip", [{ startDate: new Date("2027-10-08"), status: "OPEN", seatsLeft: 40 }]);
  assert.equal(rows[0].status, "OPEN");
  assert.equal(rows[1].status, "CANCELLED");
});
