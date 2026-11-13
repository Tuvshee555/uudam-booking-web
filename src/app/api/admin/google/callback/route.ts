import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { signAccessToken } from "@/server/auth";
import { clientIp, rateLimit } from "@/server/http";
import {
  GOOGLE_STATE_COOKIE,
  allowedAdminEmails,
  checkGoogleIdToken,
  clearedCookie,
  exchangeGoogleCode,
  googleRedirectUri,
  googleSignInAvailable,
  handoffCookie,
  readCookie,
  readGoogleStateCookie,
  signInOrigin,
  statesMatch,
  type GoogleSignInError,
} from "@/server/googleAuth";

export const dynamic = "force-dynamic";

/**
 * Google returns here with ?code&state. A listed, verified account gets a one-minute HttpOnly
 * hand-off cookie and lands on the login page, which swaps it for the session token
 * (./session). Anything else lands on the login page with ?login_error=<reason>.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = signInOrigin(req);
  const saved = readGoogleStateCookie(readCookie(req, GOOGLE_STATE_COOKIE));

  const fail = (error: GoogleSignInError) => {
    const res = NextResponse.redirect(`${origin}/mn/admin/log-in?login_error=${error}`, 303);
    res.headers.append("Set-Cookie", clearedCookie(GOOGLE_STATE_COOKIE));
    res.headers.set("Cache-Control", "no-store");
    return res;
  };

  if (!googleSignInAvailable()) return fail("google_not_configured");
  if (!saved || !statesMatch(saved.state, url.searchParams.get("state") || "")) return fail("google_state_mismatch");
  const code = url.searchParams.get("code");
  if (!code) return fail("google_cancelled");

  // Refused accounts are charged against a per-IP budget (20 per 15 min).
  const charge = () => {
    try {
      rateLimit(`admin-google:${clientIp(req)}`, { windowMs: 15 * 60 * 1000, max: 20 });
      return true;
    } catch {
      return false;
    }
  };

  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const idToken = await exchangeGoogleCode(code, clientId, process.env.GOOGLE_CLIENT_SECRET!.trim(), googleRedirectUri(origin));
  if (!idToken) return fail("google_exchange_failed");

  const checked = checkGoogleIdToken(idToken, clientId, allowedAdminEmails());
  if (!checked.ok) {
    console.warn("admin.google_sign_in_refused", checked.error);
    if (!charge()) return fail("google_email_not_allowed");
    return fail(checked.error);
  }

  // The staff row is what enquiries/bookings point at ("handled by"); the allow-list, not this
  // row, decides access. A listed address signing in for the first time gets one.
  const user = await prisma.user.upsert({
    where: { email: checked.email },
    update: { isVerified: true },
    create: { email: checked.email, role: "ADMIN", isVerified: true },
    select: { id: true, role: true, email: true },
  });

  const token = signAccessToken({ id: user.id, role: user.role, email: user.email });
  console.info("admin.google_sign_in", user.email);

  const landing = new URL("/mn/admin/log-in", origin);
  landing.searchParams.set("google", "1");
  landing.searchParams.set("from", saved.returnPath);
  const res = NextResponse.redirect(landing, 303);
  res.headers.append("Set-Cookie", clearedCookie(GOOGLE_STATE_COOKIE));
  res.headers.append("Set-Cookie", handoffCookie(token));
  res.headers.set("Cache-Control", "no-store");
  return res;
}
