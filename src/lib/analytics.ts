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

const RECENT_KEY = "uudam-recent-trips";
const RECENT_LIMIT = 8;

/** Most-recent-first list of trip slugs the visitor has opened, capped at 8. */
export function recordRecentlyViewed(slug: string) {
  try {
    const existing = getRecentlyViewed();
    const next = [slug, ...existing.filter((s) => s !== slug)].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private mode / storage blocked — recently-viewed is a nice-to-have, not
    // worth surfacing an error for.
  }
}

export function getRecentlyViewed(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Fire-and-forget funnel signal: a share tap, a save toggle, a phone/Messenger
 * click, a departure pick. TripView already answers "views vs. enquiries" —
 * this fills the part between the two that was previously invisible: whether
 * anyone engages with a trip page before deciding not to enquire.
 *
 * Deliberately not awaited by callers. A click handler should never wait on
 * a network request before doing its actual job (opening a share sheet,
 * a tel: link, a Messenger deep link).
 */
export function track(
  name:
    | "share_click"
    | "save_toggle"
    | "phone_click"
    | "messenger_click"
    | "departure_select"
    | "custom_trip_submit"
    | "gift_submit",
  options?: { tripId?: string; properties?: Record<string, unknown> },
) {
  try {
    const payload = JSON.stringify({
      name,
      tripId: options?.tripId,
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
      properties: options?.properties,
    });

    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never surface an error to a visitor.
  }
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
