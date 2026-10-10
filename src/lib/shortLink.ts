import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Root-level short links: `uudamtravel.mn/<alias>` -> wherever the owner pointed it.
 *
 * The links themselves live in the separate `short-link` app (its own database
 * and dashboard). This module only asks it "is /<alias> one of yours?" for
 * locale-less, single-segment paths, and passes its redirect through.
 *
 * Designed so it can never hurt the site:
 *  - OFF unless SHORTLINK_ORIGIN is set (unset = behaviour identical to before);
 *  - only GET/HEAD on a single path segment that is not a page of this site;
 *  - 2.5 s timeout, and ANY failure (down, slow, 404, bad data) simply falls
 *    through to the normal "add the locale prefix" behaviour in proxy.ts.
 */

const ALIAS_PATH = /^\/[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?$/;

/**
 * Top-level routes of this site (src/app/[locale]/*, the locales, assets). They
 * can never be short links, so skip the lookup. Keep in sync with
 * RESERVED_ALIASES in the short-link app, which refuses to create these.
 */
const SKIP = new Set([
  "mn",
  "en",
  "ko",
  "about",
  "booking",
  "category",
  "contact",
  "custom-trip",
  "data-deletion",
  "departures",
  "discover",
  "faq",
  "gift",
  "guide",
  "provider",
  "qa-pricing",
  "saved",
  "terms",
  "trips",
  "admin",
  "api",
  "images",
  "public",
]);

const LOOKUP_TIMEOUT_MS = 2500;

export async function resolveShortLink(request: NextRequest): Promise<NextResponse | null> {
  const origin = process.env.SHORTLINK_ORIGIN?.trim().replace(/\/+$/, "");
  if (!origin) return null;

  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const { pathname } = request.nextUrl;
  if (!ALIAS_PATH.test(pathname)) return null;
  if (SKIP.has(pathname.slice(1).toLowerCase())) return null;

  try {
    const headers: Record<string, string> = {
      // Lets the short-link app tell humans from crawlers when counting clicks.
      "user-agent": request.headers.get("user-agent") ?? "",
    };
    for (const name of ["sec-purpose", "purpose"]) {
      const value = request.headers.get(name);
      if (value) headers[name] = value;
    }

    const response = await fetch(`${origin}${pathname}`, {
      method: request.method,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      headers,
    });

    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) return null;

    // Defence in depth: only ever forward to a web address.
    const target = new URL(location);
    if (target.protocol !== "http:" && target.protocol !== "https:") return null;

    const redirect = NextResponse.redirect(target, 302);
    redirect.headers.set("Cache-Control", "no-store");
    return redirect;
  } catch {
    return null;
  }
}
