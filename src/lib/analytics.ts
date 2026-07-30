"use client";

/**
 * Browser side of the first-party analytics.
 *
 * The ids here are random and generated locally — they are not derived from
 * anything about the person, and they never leave this origin. `visitorId`
 * persists so returning visitors can be recognised as returning; `sessionId`
 * lives for the tab only.
 */

const VISITOR_KEY = "uudam-visitor";
const SESSION_KEY = "uudam-session";

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;

    const id = randomId();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    // Private mode / storage blocked: fall back to a per-page id so the view
    // is still counted, just never linked to another one.
    return randomId();
  }
}

export function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const id = randomId();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

/** Video plays counted on the current page, read by the beacon on exit. */
let videoPlays = 0;

export function recordVideoPlay() {
  videoPlays += 1;
}

export function resetVideoPlays() {
  videoPlays = 0;
}

export function getVideoPlays() {
  return videoPlays;
}

export type TrackInput = {
  path: string;
  source?: string | null;
};

/** Open a view. Returns the row id the exit beacon needs, or null on failure. */
export async function trackView({ path, source }: TrackInput): Promise<string | null> {
  try {
    const res = await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        source: source ?? null,
        visitorId: getVisitorId(),
        sessionId: getSessionId(),
        referrer: document.referrer || null,
      }),
      keepalive: true,
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { viewId?: string };
    return data.viewId ?? null;
  } catch {
    // Analytics must never surface an error to a visitor.
    return null;
  }
}

/**
 * Close a view out with time on page.
 *
 * sendBeacon is used because a normal fetch is cancelled when the tab closes —
 * this is the one request that has to survive the page going away.
 */
export function closeView(viewId: string, startedAt: number) {
  const payload = JSON.stringify({
    viewId,
    durationMs: Date.now() - startedAt,
    videoPlays: getVideoPlays(),
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      return;
    }
  } catch {
    // fall through
  }

  // sendBeacon only ever POSTs, and the server treats POST as "new view", so
  // the fallback has to be an explicit PATCH.
  fetch("/api/track", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}
