import { httpError } from "@/server/http";

const timeoutMs = 20_000;

function endpoint() {
  const base = (process.env.CHATBOT_SYNC_URL || process.env.NEXT_PUBLIC_CHATBOT_URL || "").replace(/\/$/, "");
  return base ? `${base}/api/internal/website-trip` : "";
}

export function assertChatbotTripSyncConfigured() {
  if (!endpoint() || !process.env.CHATBOT_SYNC_SECRET) {
    throw httpError(503, "Chatbot sync тохируулаагүй байна. Аяллыг салангид хадгалахаас сэргийлж хадгалсангүй.");
  }
}

/** Push shared, customer-facing trip facts to the chatbot's canonical record. */
export async function syncTripToChatbot(trip: unknown) {
  assertChatbotTripSyncConfigured();
  const response = await fetch(endpoint(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-trip-sync-secret": process.env.CHATBOT_SYNC_SECRET!,
    },
    body: JSON.stringify({ trip }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });

  if (!response.ok) {
    throw httpError(502, "Chatbot, website, poster синк хийхэд алдаа гарлаа. Дахин оролдоно уу.");
  }
}

export async function deleteTripFromChatbot(sourceTripId: string | null) {
  if (!sourceTripId) return;
  assertChatbotTripSyncConfigured();
  const response = await fetch(endpoint(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-trip-sync-secret": process.env.CHATBOT_SYNC_SECRET!,
    },
    body: JSON.stringify({ action: "delete", sourceTripId }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!response.ok && response.status !== 404) {
    throw httpError(502, "Chatbot, website, poster синк хийхэд алдаа гарлаа. Дахин оролдоно уу.");
  }
}
