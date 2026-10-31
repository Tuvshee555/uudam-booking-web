import { httpError } from "@/server/http";

const timeoutMs = 20_000;

function endpoint() {
  const base = (process.env.CHATBOT_SYNC_URL || process.env.NEXT_PUBLIC_CHATBOT_URL || "").replace(/\/$/, "");
  return base ? `${base}/api/internal/website-trip` : "";
}

export function assertChatbotTripSyncConfigured() {
  if (!endpoint() || !process.env.CHATBOT_SYNC_SECRET) {
    throw httpError(424, "Chatbot sync тохируулаагүй байна. Аяллыг chatbot/poster-той салангид болгохгүйн тулд үйлдлийг зогсоолоо.");
  }
}

/** What the chatbot did with one delivery (older chatbot builds send none of it). */
export type ChatbotSyncReport = {
  applied: string[];
  conflicts: Array<Record<string, unknown>>;
  ignored: Array<{ field: string; reason: string }>;
};

/** A failed delivery, kept on the queued edit so staff can see why it is waiting. */
export class ChatbotSyncError extends Error {
  constructor(message: string, readonly status: number | null, readonly code: string) {
    super(message);
    this.name = "ChatbotSyncError";
  }
}

const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

async function post(body: unknown): Promise<{ response: Response; data: Record<string, unknown> }> {
  assertChatbotTripSyncConfigured();
  let response: Response;
  try {
    response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-trip-sync-secret": process.env.CHATBOT_SYNC_SECRET!,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new ChatbotSyncError(timedOut ? `No answer within ${timeoutMs / 1000} s` : "Chatbot unreachable", null, timedOut ? "timeout" : "network");
  }
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { response, data };
}

function failure(response: Response, data: Record<string, unknown>, what: string): ChatbotSyncError {
  const code = typeof data.error === "string" ? data.error : "http_error";
  const detail = typeof data.message === "string" ? `: ${data.message.slice(0, 200)}` : "";
  console.error(`Chatbot ${what} failed`, response.status, code);
  return new ChatbotSyncError(`HTTP ${response.status} ${code}${detail}`, response.status, code);
}

/**
 * Push shared, customer-facing trip facts to the chatbot's canonical record.
 * `changedFields` names what staff edited, so the chatbot can report any of
 * them it did not take instead of answering a bare success.
 */
export async function syncTripToChatbot(trip: unknown, previousTrip?: unknown, changedFields?: string[]): Promise<ChatbotSyncReport> {
  const { response, data } = await post({ trip, previousTrip, ...(changedFields ? { changedFields } : {}) });
  if (!response.ok) throw failure(response, data, "trip sync");
  return {
    applied: list<string>(data.applied),
    conflicts: list<Record<string, unknown>>(data.conflicts),
    ignored: list<{ field: string; reason: string }>(data.ignored),
  };
}

export async function deleteTripFromChatbot(sourceTripId: string | null) {
  if (!sourceTripId) return;
  const { response, data } = await post({ action: "delete", sourceTripId });
  if (!response.ok && response.status !== 404) throw failure(response, data, "trip delete sync");
}

/** Settle one recorded disagreement in the chatbot's canonical record. */
export async function resolveChatbotConflict(sourceTripId: string, conflict: unknown, resolution: "website" | "chatbot", resolvedBy: string) {
  const { response, data } = await post({ action: "resolve_conflict", sourceTripId, conflict, resolution, resolvedBy });
  if (!response.ok) throw failure(response, data, "conflict resolution");
  return { open: typeof data.open === "number" ? data.open : null };
}
