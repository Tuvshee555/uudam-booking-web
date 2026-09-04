import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { handler, httpError, rateLimit, readJson, safeText } from "@/server/http";

/** The only names the API will accept — an unbounded free-text metric name
 * would let a single bad client fill this table with anything. */
const EVENT_NAMES = new Set([
  "share_click",
  "save_toggle",
  "phone_click",
  "messenger_click",
  "departure_select",
  "enquiry_start",
  "custom_trip_submit",
  "gift_submit",
]);

/**
 * POST /api/events — fire-and-forget funnel signals.
 *
 * Never blocks or errors visibly: the caller uses `keepalive` fetch and
 * ignores the response. Rate limited per visitor rather than per IP, since
 * this fires far more often than an enquiry and a shared office IP shouldn't
 * throttle everyone behind it.
 */
export const POST = handler(async (req: Request) => {
  const body = await readJson(req);

  const name = typeof body.name === "string" ? body.name : "";
  if (!EVENT_NAMES.has(name)) throw httpError(400, "Unknown event");

  const visitorId = safeText(body.visitorId, 64);
  if (!visitorId) throw httpError(400, "Missing visitorId");

  rateLimit(`event:${visitorId}`, { windowMs: 60 * 1000, max: 40 });

  await prisma.analyticsEvent.create({
    data: {
      name,
      tripId: safeText(body.tripId, 60),
      visitorId,
      sessionId: safeText(body.sessionId, 64) ?? visitorId,
      properties:
        body.properties && typeof body.properties === "object" ? body.properties : undefined,
    },
  });

  return NextResponse.json({ ok: true });
});
