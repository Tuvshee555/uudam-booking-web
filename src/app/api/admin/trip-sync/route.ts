import { requireAdmin } from "@/server/auth";
import { handler, json, readJson, httpError } from "@/server/http";
import { deliverTripSync } from "@/server/tripSyncQueue";
import { prisma } from "@/server/prisma";
import { TRIP_INCLUDE } from "@/server/tripInput";

export const POST = handler(async (req: Request) => {
  await requireAdmin(req);
  const body = await readJson(req);
  if (typeof body.id !== "string") throw httpError(400, "Trip ID is required");
  const complete = await deliverTripSync(body.id);
  const trip = await prisma.trip.findUnique({ where: { id: body.id }, include: TRIP_INCLUDE });
  if (!trip) throw httpError(404, "Аялал олдсонгүй");
  return json({ complete, trip });
});
