import type { Metadata } from "next";

import { getPublicBookingStatus } from "@/server/booking";
import type { BookingStatus } from "./BookingStatusClient";
import BookingStatusClient from "./BookingStatusClient";

export const metadata: Metadata = {
  title: "Захиалгын дугаар",
  // Robots.txt already blocks nothing here structurally, but a booking
  // reference page has no reason to be in search results for anyone else's
  // booking number, so keep it out explicitly.
  robots: { index: false, follow: false },
};

export default async function BookingStatusPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  // Seeded here rather than left to the client fetch: without this, a
  // customer opening their own confirmation link saw a loading spinner and
  // then, for a moment before the client query resolved, "Захиалга
  // олдсонгүй" — a real booking briefly reporting itself not found.
  const booking = await getPublicBookingStatus(reference);

  return (
    <BookingStatusClient
      reference={reference}
      initialData={booking ? (JSON.parse(JSON.stringify(booking)) as BookingStatus) : undefined}
    />
  );
}
