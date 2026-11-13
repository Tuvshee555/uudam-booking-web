import jwt from "jsonwebtoken";
import { allowedAdminEmails, isStrongSecret } from "./googleAuth";

export type AuthUser = { id: string; role: "STAFF" | "ADMIN" };

/**
 * Verifies a session token. Only tokens minted by "Sign in with Google" count (`via: "google"`),
 * and only while their address is still on ADMIN_GOOGLE_EMAILS — taking someone off the list
 * locks them out on their next request, whatever token they hold. Password-era tokens, reset
 * tokens and tokens signed with a weak JWT_SECRET are all refused.
 */
export function verifySessionToken(token: string): (AuthUser & { email: string }) | null {
  const secret = process.env.JWT_SECRET;
  if (!isStrongSecret(secret)) {
    console.error("JWT_SECRET is missing or weak; refusing every admin session");
    return null;
  }

  let decoded: Record<string, unknown>;
  try {
    decoded = jwt.verify(token, secret!, { algorithms: ["HS256"] }) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (decoded?.type !== "access" || decoded?.via !== "google") return null;

  const userId = typeof decoded.id === "string" ? decoded.id : "";
  const email = typeof decoded.email === "string" ? decoded.email.trim().toLowerCase() : "";
  if (!userId || !email || !allowedAdminEmails().includes(email)) return null;

  const role = decoded.role === "ADMIN" ? "ADMIN" : "STAFF";
  return { id: userId, role, email };
}

/** Mints a session for an address Google has just vouched for (see /api/admin/google/callback). */
export function signAccessToken(payload: { id: string; role: string; email: string }) {
  const secret = process.env.JWT_SECRET;
  if (!isStrongSecret(secret)) throw new Error("Auth misconfiguration: JWT_SECRET is missing or weak");

  return jwt.sign({ ...payload, email: payload.email.toLowerCase(), type: "access", via: "google" }, secret!, {
    algorithm: "HS256",
    expiresIn: "7d",
  });
}
