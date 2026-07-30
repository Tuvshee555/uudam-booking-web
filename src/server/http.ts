import { NextResponse } from "next/server";

/**
 * Small helpers shared by every route handler, replacing what Express
 * middleware used to do (JSON responses, error shaping, cache headers and
 * per-IP rate limiting).
 */

export type ApiError = Error & { status?: number; code?: string };

export function httpError(status: number, message: string, code?: string): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  if (code) err.code = code;
  return err;
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/**
 * Cache-Control for public, read-only endpoints (trips, categories, reviews)
 * so browsers and Vercel's CDN can serve repeat requests without touching the
 * database. Never use on user-specific data.
 */
export function publicCache(res: NextResponse, maxAge = 15, swr = 30) {
  res.headers.set(
    "Cache-Control",
    `public, max-age=${maxAge}, stale-while-revalidate=${swr}`,
  );
  return res;
}

/**
 * Wraps a handler so a thrown error becomes a JSON response instead of an
 * unhandled rejection. Errors created via `httpError` keep their status; every
 * other throw is a 500 with no internals leaked to the client.
 */
export function handler<Ctx>(
  fn: (req: Request, ctx: Ctx) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      const e = err as ApiError;
      const status = typeof e?.status === "number" ? e.status : 500;

      if (status >= 500) {
        console.error(`API ${req.method} ${new URL(req.url).pathname} failed:`, err);
      }

      return NextResponse.json(
        {
          message: status >= 500 ? "Internal server error" : e.message,
          ...(e.code ? { code: e.code } : {}),
        },
        { status },
      );
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw httpError(400, "Invalid JSON body");
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * In-memory fixed-window rate limiter, the replacement for express-rate-limit.
 *
 * Caveat worth knowing: on serverless each lambda keeps its own counter, so the
 * effective limit is per-instance rather than global. That is still enough to
 * blunt a single client hammering OTP or checkout endpoints, which is what
 * these limits are for.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  { windowMs, max }: { windowMs: number; max: number },
) {
  const now = Date.now();
  const hit = buckets.get(key);

  if (!hit || now > hit.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  hit.count += 1;

  if (hit.count > max) {
    throw httpError(429, "Хэт олон хүсэлт. Түр хүлээгээд дахин оролдоно уу.");
  }

  // Opportunistic cleanup so the map can't grow without bound.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now > v.resetAt) buckets.delete(k);
    }
  }
}

export function parsePositiveInt(value: unknown, fallback: number, max = 100) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

/** Trim a string field, returning null for blank/absent values. */
export function safeText(v: unknown, maxLength = 500): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed.length) return null;
  return trimmed.slice(0, maxLength);
}
