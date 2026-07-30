import { prisma } from "@/server/prisma";
import { clientIp, handler, json, rateLimit, readJson, safeText } from "@/server/http";

export const dynamic = "force-dynamic";

/** Crude UA bucket. Enough to answer "is this mostly phones?" and nothing more. */
function deviceFrom(userAgent: string | null): string {
  if (!userAgent) return "unknown";
  if (/bot|crawler|spider|preview|facebookexternalhit|headless/i.test(userAgent)) return "bot";
  if (/mobile|android|iphone|ipod/i.test(userAgent)) return "mobile";
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  return "desktop";
}

/**
 * Strip a referrer down to its host.
 *
 * Full referrer URLs can carry query strings with personal data in them, and
 * the only question anyone actually asks is "which site sent them".
 */
function referrerHost(referrer: unknown): string | null {
  const raw = safeText(referrer, 500);
  if (!raw) return null;

  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return raw.slice(0, 100);
  }
}

/**
 * POST /api/track — record a page view.
 *
 * First-party and deliberately minimal: an anonymous id the browser made up for
 * itself, the path, where they came from, and how long they stayed. No IP is
 * stored, no cross-site identifier, no third-party script.
 */
export const POST = handler(async (req: Request) => {
  const body = await readJson(req);

  // navigator.sendBeacon can only ever issue a POST, and the exit beacon is the
  // one request that must survive the tab closing — so a POST carrying a
  // viewId is a close-out, not a new view. Without this branch every visit
  // would be counted twice.
  if (safeText(body.viewId, 64)) {
    return closeOutView(body);
  }

  const visitorId = safeText(body.visitorId, 64);
  const sessionId = safeText(body.sessionId, 64);
  const path = safeText(body.path, 500);

  if (!visitorId || !sessionId || !path) {
    return json({ ok: false }, { status: 204 });
  }

  // Never let analytics take the site down or become a spam vector.
  rateLimit(`track:${clientIp(req)}`, { windowMs: 60 * 1000, max: 60 });

  const device = deviceFrom(req.headers.get("user-agent"));

  // Bots inflate every number they touch and answer no question the agency has.
  if (device === "bot") return json({ ok: true, skipped: "bot" });

  // The admin panel is staff looking at their own site.
  if (/^\/(mn|en|ko)\/admin/.test(path)) return json({ ok: true, skipped: "admin" });

  // The trip is resolved from the path rather than sent by the client, so a
  // single site-wide tracker covers every page without the trip page needing
  // its own (which would double-count every trip view).
  const slug = path.match(/^\/(?:mn|en|ko)\/trips\/([^/?#]+)/)?.[1] ?? null;

  const trip = slug
    ? await prisma.trip.findUnique({ where: { slug }, select: { id: true } })
    : null;

  const view = await prisma.tripView.create({
    data: {
      tripId: trip?.id ?? null,
      path,
      visitorId,
      sessionId,
      referrer: referrerHost(body.referrer),
      source: safeText(body.source, 120),
      device,
    },
    select: { id: true },
  });

  return json({ ok: true, viewId: view.id });
});

/**
 * Close a view out with time on page.
 *
 * Reached from either verb, because the exit beacon has no choice about which
 * one it uses. Must never reject: the visitor is already gone and there is no
 * chance to retry.
 */
async function closeOutView(body: Record<string, unknown>) {
  const viewId = safeText(body.viewId, 64);
  if (!viewId) return json({ ok: false }, { status: 204 });

  const durationMs = Number(body.durationMs);
  const videoPlays = Number(body.videoPlays);

  // A tab left open overnight is not eight hours of reading; cap it at 30
  // minutes so one forgotten tab can't distort every average.
  const cappedDuration =
    Number.isFinite(durationMs) && durationMs > 0
      ? Math.min(Math.round(durationMs), 30 * 60 * 1000)
      : 0;

  await prisma.tripView
    .update({
      where: { id: viewId },
      data: {
        durationMs: cappedDuration,
        ...(Number.isFinite(videoPlays) && videoPlays > 0
          ? { videoPlays: Math.min(Math.round(videoPlays), 100) }
          : {}),
      },
    })
    .catch(() => {
      // The row may have been pruned, or the id was junk. Either way the
      // visitor is already gone — swallow it.
    });

  return json({ ok: true });
}

/** PATCH /api/track — the non-beacon fallback path. */
export const PATCH = handler(async (req: Request) => {
  const body = await readJson(req);
  return closeOutView(body);
});
