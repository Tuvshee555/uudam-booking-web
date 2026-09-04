import type { Metadata } from "next";

import { prisma } from "@/server/prisma";
import { TRIP_INCLUDE } from "@/server/tripInput";
import type { Trip } from "@/types/trip";
import DeparturesPageClient from "./DeparturesPageClient";

export const metadata: Metadata = {
  title: "Аяллын хуваарь",
  description:
    "Uudam Travel-ийн ойрын хугацаанд хөдлөх бүх аялал огноогоор. Хэзээ явахаа мэдэж байгаа бол эндээс сонгоно уу.",
  openGraph: {
    title: "Аяллын хуваарь · Uudam Travel",
    description: "Ойрын хугацаанд хөдлөх аяллуудыг огноогоор нь харна уу.",
    type: "website",
  },
};

/**
 * Without this the page is prerendered once at build time and its data is
 * frozen until the next deploy — staff edit trips daily, and the departures
 * cutoff is a `new Date()` that would freeze with it.
 */
export const revalidate = 60;

/**
 * Only trips that actually have a future departure. Pulling the whole
 * catalogue here would ship 33 trips to render a dozen rows.
 */
export default async function DeparturesPage() {
  const trips = await prisma.trip.findMany({
    where: {
      isPublished: true,
      departures: {
        some: {
          startDate: { gte: new Date() },
          status: { notIn: ["CANCELLED", "DEPARTED"] },
        },
      },
    },
    include: TRIP_INCLUDE,
  });

  return <DeparturesPageClient trips={JSON.parse(JSON.stringify(trips)) as Trip[]} />;
}
