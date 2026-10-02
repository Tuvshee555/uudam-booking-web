import { NextResponse } from "next/server";

import { requireAdmin } from "@/server/auth";
import { handler, httpError } from "@/server/http";
import { geocodeSearch } from "@/server/weather/places";

/** GET /api/weather/geocode?q=… — admin place search for a trip's weather stops. */
export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 120);
  if (!q || q.length < 2) throw httpError(400, "Хайх үгээ оруулна уу");
  return NextResponse.json(await geocodeSearch(q));
});
