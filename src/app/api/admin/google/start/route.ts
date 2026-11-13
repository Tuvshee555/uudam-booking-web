import { NextResponse } from "next/server";
import {
  buildGoogleAuthUrl,
  googleRedirectUri,
  googleSignInAvailable,
  googleStateCookie,
  newGoogleState,
  safeAdminReturnPath,
  signInOrigin,
} from "@/server/googleAuth";

export const dynamic = "force-dynamic";

/** GET → Google's account chooser; Google sends the browser back to ./callback. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = signInOrigin(req);
  const returnPath = safeAdminReturnPath(url.searchParams.get("from"));

  if (!googleSignInAvailable()) {
    return noStore(NextResponse.redirect(`${origin}/mn/admin/log-in?login_error=google_not_configured`, 303));
  }

  // Started on www or *.vercel.app: begin again on the sign-in host so the state cookie
  // is set where the callback will read it.
  const requestHost = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || url.host;
  if (new URL(origin).host !== requestHost) {
    const restart = new URL("/api/admin/google/start", origin);
    restart.searchParams.set("from", returnPath);
    return noStore(NextResponse.redirect(restart, 303));
  }

  const state = newGoogleState();
  const res = NextResponse.redirect(
    buildGoogleAuthUrl(process.env.GOOGLE_CLIENT_ID!.trim(), googleRedirectUri(origin), state),
    303,
  );
  res.headers.append("Set-Cookie", googleStateCookie(state, returnPath));
  return noStore(res);
}

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  return res;
}
