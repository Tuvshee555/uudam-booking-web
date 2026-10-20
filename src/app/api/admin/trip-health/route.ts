import { requireAdmin } from "@/server/auth";
import { handler, json } from "@/server/http";
import { buildTripHealthReport } from "@/server/tripHealthReport";

export const dynamic = "force-dynamic";

/** GET /api/admin/trip-health — every automatic trip check, for the admin "Шалгалт" page. */
export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  return json(await buildTripHealthReport());
});
