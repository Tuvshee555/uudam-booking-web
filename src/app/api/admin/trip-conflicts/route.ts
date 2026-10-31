import { requireAdmin } from "@/server/auth";
import { handler, httpError, json, readJson } from "@/server/http";
import { prisma } from "@/server/prisma";
import { ChatbotSyncError, resolveChatbotConflict } from "@/server/chatbotTripSync";

const MESSAGES: Record<string, string> = {
  conflict_not_found: "Энэ зөрүү аль хэдийн шийдэгдсэн байна. Харьцуулалтыг шинэчилнэ үү.",
  conflict_needs_manual_edit: "Энэ зөрүүг автоматаар хэрэглэх боломжгүй — аяллыг гараар засаад «Chatbot-ын утгыг үлдээх»-ээр хаана уу.",
  trip_edit_conflict: "Chatbot дээр яг одоо засвар хийгдэж байна. Хэсэг хүлээгээд дахин оролдоно уу.",
};

/** Settles one website ↔ chatbot disagreement, recorded with who decided it. */
export const POST = handler(async (req: Request) => {
  const admin = await requireAdmin(req);
  const body = await readJson<{ tripId?: unknown; conflict?: unknown; resolution?: unknown }>(req);
  if (typeof body.tripId !== "string" || !body.conflict || typeof body.conflict !== "object") throw httpError(400, "Зөрүү сонгогдоогүй байна");
  if (body.resolution !== "website" && body.resolution !== "chatbot") throw httpError(400, "Аль утгыг авахаа сонгоно уу");
  const trip = await prisma.trip.findUnique({ where: { id: body.tripId }, select: { sourceTripId: true } });
  if (!trip) throw httpError(404, "Аялал олдсонгүй");
  if (!trip.sourceTripId) throw httpError(400, "Энэ аялал chatbot-той холбогдоогүй");
  try {
    const result = await resolveChatbotConflict(trip.sourceTripId, body.conflict, body.resolution, `website-admin:${admin.id}`);
    return json({ ok: true, open: result.open });
  } catch (error) {
    if (error instanceof ChatbotSyncError) {
      const message = MESSAGES[error.code];
      if (message) throw httpError(error.status === 404 ? 404 : 409, message);
      throw httpError(424, "Chatbot руу хүргэж чадсангүй. Дахин оролдоно уу.");
    }
    throw error;
  }
});
