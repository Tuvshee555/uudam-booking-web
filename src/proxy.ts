import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LOCALES = ["mn", "en", "ko"];
const DEFAULT_LOCALE = "mn";

const STATIC_PREFIXES = ["/_next/", "/favicon", "/images", "/api", "/public"];

/** Admin pages that must stay reachable without a session. */
const PUBLIC_ADMIN_PATHS = ["/admin/log-in", "/admin/forgot-password", "/admin/reset-password"];

/**
 * One middleware for both halves of the app now that the storefront and the
 * admin panel share a deployment: every path gets a locale prefix, and only
 * `/admin/*` is gated on a session cookie.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (!hasLocale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
    return NextResponse.redirect(url);
  }

  const locale = pathname.match(/^\/(mn|en|ko)/)?.[1] ?? DEFAULT_LOCALE;
  const pathWithoutLocale = pathname.replace(/^\/(mn|en|ko)/, "") || "/";

  if (!pathWithoutLocale.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (PUBLIC_ADMIN_PATHS.some((path) => pathWithoutLocale.startsWith(path))) {
    return NextResponse.next();
  }

  // The cookie is only a gate for the page shell — every admin API route
  // re-checks the ADMIN role against the database, so a forged cookie buys
  // nothing but a redirect-free empty screen.
  const token = request.cookies.get("token")?.value;

  if (!token) {
    const loginUrl = new URL(`/${locale}/admin/log-in`, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
