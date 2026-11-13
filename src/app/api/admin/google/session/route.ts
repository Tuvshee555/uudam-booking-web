import { NextResponse } from "next/server";
import { verifySessionToken } from "@/server/auth";
import { GOOGLE_HANDOFF_COOKIE, clearedCookie, readCookie } from "@/server/googleAuth";

export const dynamic = "force-dynamic";

/**
 * POST → the login page swaps the one-minute hand-off cookie the callback set for the session
 * token (kept in the browser like before and sent as a Bearer header). The cookie is cleared on
 * the first call, so it can be used once. SameSite=Lax keeps other sites from sending it here.
 */
export async function POST(req: Request) {
  const token = readCookie(req, GOOGLE_HANDOFF_COOKIE);
  const session = token ? verifySessionToken(token) : null;

  const res = session
    ? NextResponse.json({ token, email: session.email })
    : NextResponse.json({ message: "Google-ээр дахин нэвтэрнэ үү", code: "google_handoff_missing" }, { status: 401 });
  res.headers.append("Set-Cookie", clearedCookie(GOOGLE_HANDOFF_COOKIE));
  res.headers.set("Cache-Control", "no-store");
  return res;
}
