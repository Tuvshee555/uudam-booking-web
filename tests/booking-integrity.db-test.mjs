// Seat accounting against a real Postgres: row locks, transactions and races
// only exist there, so these cannot be faked like the unit tests. Run with
//
//   TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/scratch npm run test:db
//
// The database must be disposable and on this machine (the schema comes from
// `prisma db push`); anything else is refused. Every test makes its own trip,
// so the file can run against the same database repeatedly.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

const url = process.env.TEST_DATABASE_URL ?? "";
const local = /@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);

if (!local) {
  test("booking integrity against Postgres", { skip: "set TEST_DATABASE_URL to a disposable local database" }, () => {});
} else {
  process.env.DATABASE_URL = url;
  const { prisma } = await import("../src/server/prisma.ts");
  const booking = await import("../src/server/booking.ts");
  after(() => prisma.$disconnect());

  const DAY = 24 * 60 * 60 * 1000;
  let phones = 0;

  async function departure({ seatsLeft = 5, status = "OPEN", startsInDays = 30, published = true } = {}) {
    const trip = await prisma.trip.create({
      data: {
        slug: `seat-test-${randomUUID().slice(0, 8)}`,
        title: "Seat test",
        description: "",
        image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        price: 1_000_000,
        isPublished: published,
      },
    });
    const row = await prisma.departure.create({
      data: { tripId: trip.id, startDate: new Date(Date.now() + startsInDays * DAY), seatsTotal: seatsLeft, seatsLeft, status },
    });
    return { trip, departure: row };
  }

  function order({ trip, departure: row }, party = {}) {
    const reference = `UUD-B-T${randomUUID().slice(0, 8).toUpperCase()}`;
    return {
      tripId: trip.id,
      departureId: row.id,
      adults: 1,
      children: 0,
      infants: 0,
      firstName: "Test",
      phone: `8800${String(++phones).padStart(4, "0")}`,
      reference,
      paymentReference: reference,
      ...party,
    };
  }

  const seatsLeft = async (id) => (await prisma.departure.findUniqueOrThrow({ where: { id } })).seatsLeft;
  const statusOf = async (id) => (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;
  const holding = new Set(booking.SEAT_HOLDING_STATUSES);

  // What staff "payment recorded" does. The route used to write the status
  // directly; setBookingStatus is the seat-aware replacement where it exists.
  async function staffConfirm(id) {
    if (typeof booking.setBookingStatus === "function") {
      return booking.setBookingStatus(id, "CONFIRMED").catch((error) => error);
    }
    return prisma.booking.update({ where: { id }, data: { status: "CONFIRMED", holdExpiresAt: null } });
  }

  test("simultaneous bookings never sell more seats than a date has", async () => {
    const fixture = await departure({ seatsLeft: 3 });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => booking.createBooking(order(fixture))));
    const made = results.filter((result) => result.status === "fulfilled");
    for (const result of results.filter((entry) => entry.status === "rejected")) {
      const reason = result.reason;
      assert.ok(reason instanceof booking.BookingError || ["P2028", "P2034"].includes(reason?.code), `unexpected failure: ${reason}`);
    }
    assert.equal(made.length, 3);
    assert.equal(await seatsLeft(fixture.departure.id), 0);
    assert.equal(await prisma.booking.count({ where: { departureId: fixture.departure.id, status: "HELD" } }), 3);
  });

  test("a booking is checked against the database, not against what a cached page showed", async () => {
    const soldByPhone = await departure({ seatsLeft: 2 });
    await prisma.departure.update({ where: { id: soldByPhone.departure.id }, data: { seatsLeft: 0 } });
    await assert.rejects(booking.createBooking(order(soldByPhone)), (error) => error.status === 409);

    const tooMany = await departure({ seatsLeft: 2 });
    await assert.rejects(booking.createBooking(order(tooMany, { adults: 3 })), (error) => error.status === 409);
    assert.equal(await seatsLeft(tooMany.departure.id), 2);

    const closed = await departure({ seatsLeft: 9, status: "SOLD_OUT" });
    await assert.rejects(booking.createBooking(order(closed)), (error) => error.status === 409);

    const departed = await departure({ startsInDays: -1 });
    await assert.rejects(booking.createBooking(order(departed)), (error) => error.status === 409);

    const hidden = await departure({ published: false });
    await assert.rejects(booking.createBooking(order(hidden)), (error) => error.status === 404);
  });

  test("the same booking sent twice holds its seats once", async () => {
    const fixture = await departure({ seatsLeft: 5 });
    const first = order(fixture, { adults: 2 });
    const made = await booking.createBooking(first);
    const again = await booking.createBooking({ ...first, reference: `${first.reference}X` });
    assert.equal(again.reference, made.reference);
    assert.equal(again.duplicate, true);
    assert.equal(await seatsLeft(fixture.departure.id), 3);
  });

  test("cancelling gives the seats back exactly once, even when sent twice at once", async () => {
    const fixture = await departure({ seatsLeft: 5 });
    const made = await booking.createBooking(order(fixture, { adults: 2 }));
    assert.equal(await seatsLeft(fixture.departure.id), 3);
    await Promise.allSettled([booking.cancelBooking(made.id), booking.cancelBooking(made.id)]);
    assert.equal(await statusOf(made.id), "CANCELLED");
    assert.equal(await seatsLeft(fixture.departure.id), 5);
    await booking.cancelBooking(made.id);
    assert.equal(await seatsLeft(fixture.departure.id), 5);
  });

  test("an expired hold gives its seats back once", async () => {
    const fixture = await departure({ seatsLeft: 4 });
    const made = await booking.createBooking(order(fixture, { adults: 3 }));
    await prisma.booking.update({ where: { id: made.id }, data: { holdExpiresAt: new Date(Date.now() - 60_000) } });
    await booking.expireStaleHolds();
    assert.equal(await statusOf(made.id), "EXPIRED");
    assert.equal(await seatsLeft(fixture.departure.id), 4);
    await booking.expireStaleHolds();
    assert.equal(await seatsLeft(fixture.departure.id), 4);
  });

  test("a hold that has run out does not keep the last seat from the next customer", async () => {
    const fixture = await departure({ seatsLeft: 1 });
    const abandoned = await booking.createBooking(order(fixture));
    await prisma.booking.update({ where: { id: abandoned.id }, data: { holdExpiresAt: new Date(Date.now() - 60_000) } });
    const next = await booking.createBooking(order(fixture));
    assert.equal(next.status, "HELD");
    assert.equal(await statusOf(abandoned.id), "EXPIRED");
    assert.equal(await seatsLeft(fixture.departure.id), 0);
  });

  test("payment recorded after a hold expired never leaves a confirmed booking without its seats", async () => {
    const fixture = await departure({ seatsLeft: 4 });
    const made = await booking.createBooking(order(fixture, { adults: 2 }));
    await prisma.booking.update({ where: { id: made.id }, data: { holdExpiresAt: new Date(Date.now() - 60_000) } });
    await booking.expireStaleHolds();
    await staffConfirm(made.id);
    const status = await statusOf(made.id);
    const left = await seatsLeft(fixture.departure.id);
    assert.equal(left, holding.has(status) ? 2 : 4, `status ${status} with ${left} seats left`);
  });

  test("an expiry sweep racing staff payment keeps status and seats consistent", async () => {
    for (let round = 0; round < 12; round++) {
      const fixture = await departure({ seatsLeft: 4 });
      const made = await booking.createBooking(order(fixture, { adults: 2 }));
      await prisma.booking.update({ where: { id: made.id }, data: { holdExpiresAt: new Date(Date.now() - 60_000) } });
      await Promise.allSettled([booking.expireStaleHolds(), staffConfirm(made.id)]);
      const status = await statusOf(made.id);
      const left = await seatsLeft(fixture.departure.id);
      assert.equal(left, holding.has(status) ? 2 : 4, `round ${round}: status ${status} with ${left} seats left`);
    }
  });

  test("staff can only reinstate a cancelled booking while its seats are still free", { skip: typeof booking.setBookingStatus !== "function" && "setBookingStatus not in this version" }, async () => {
    const fixture = await departure({ seatsLeft: 3 });
    const made = await booking.createBooking(order(fixture, { adults: 2 }));
    await booking.cancelBooking(made.id);
    assert.equal(await seatsLeft(fixture.departure.id), 3);

    await booking.setBookingStatus(made.id, "CONFIRMED");
    assert.equal(await statusOf(made.id), "CONFIRMED");
    assert.equal(await seatsLeft(fixture.departure.id), 1);

    await booking.setBookingStatus(made.id, "EXPIRED");
    assert.equal(await seatsLeft(fixture.departure.id), 3);
    await booking.createBooking(order(fixture, { adults: 2 }));
    await assert.rejects(booking.setBookingStatus(made.id, "CONFIRMED"), (error) => error.status === 409);
    assert.equal(await statusOf(made.id), "EXPIRED");
    assert.equal(await seatsLeft(fixture.departure.id), 1);
  });

  test("a QPay invoice cannot reopen a hold that has already run out", { skip: typeof booking.markAwaitingQpay !== "function" && "markAwaitingQpay not in this version" }, async () => {
    const fixture = await departure({ seatsLeft: 2 });
    const live = await booking.createBooking(order(fixture));
    assert.equal(await booking.markAwaitingQpay(live.id), true);
    assert.equal(await statusOf(live.id), "PENDING_PAYMENT");

    const late = await booking.createBooking(order(fixture));
    await prisma.booking.update({ where: { id: late.id }, data: { holdExpiresAt: new Date(Date.now() - 60_000) } });
    await booking.expireStaleHolds();
    assert.equal(await booking.markAwaitingQpay(late.id), false);
    assert.equal(await statusOf(late.id), "EXPIRED");
    assert.equal(await seatsLeft(fixture.departure.id), 1);
  });

  test("seat changes report whether a date's open or sold-out state flipped", { skip: typeof booking.setBookingStatus !== "function" && "seat change reports not in this version" }, async () => {
    const fixture = await departure({ seatsLeft: 2 });
    const first = await booking.createBooking(order(fixture));
    assert.deepEqual(
      { slug: first.seatChange.slug, flipped: first.seatChange.availabilityChanged },
      { slug: fixture.trip.slug, flipped: false },
    );
    const last = await booking.createBooking(order(fixture));
    assert.equal(last.seatChange.availabilityChanged, true);
    const cancelled = await booking.cancelBooking(last.id);
    assert.equal(cancelled.seatChange.availabilityChanged, true);
    const again = await booking.cancelBooking(last.id);
    assert.equal(again.seatChange, null);
  });
}
