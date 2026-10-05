import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, json, httpError } from "@/server/http";
import { TRIP_INCLUDE } from "@/server/tripInput";

export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw httpError(400, "Trip ID is required");
  const website = await prisma.trip.findUnique({ where: { id }, include: TRIP_INCLUDE });
  if (!website) throw httpError(404, "Аялал олдсонгүй");
  const canonical = website.sourceTripId ? await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT id, route_name, notes, hotel, duration_text, adult_price, child_price, infant_price, currency,
      seats_total, seats_left, status, extra, updated_at
    FROM travel_trip_entries WHERE id=${website.sourceTripId}` : [];
  return json({ website, chatbot: canonical[0] || null });
});
