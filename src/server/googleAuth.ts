import crypto from "node:crypto";

/**
 * "Sign in with Google" for the admin panel (OAuth 2.0 authorization-code flow, no library) —
 * the only way a person signs in. Same design as the chatbot admin: Google only proves who the
 * person is; ADMIN_GOOGLE_EMAILS decides who gets in, at sign-in and again on every request
 * (the session token carries the address, see requireAdmin in ./auth.ts).
 *
 * Flow:
 *   /api/admin/google/start     → state cookie, redirect to Google's account chooser
 *   /api/admin/google/callback  → code exchange, allow-list check, one-minute HttpOnly hand-off cookie
 *   /api/admin/google/session   → the login page swaps the hand-off cookie for the session token
 */
export const GOOGLE_STATE_COOKIE = "uudam_admin_oauth";
export const GOOGLE_HANDOFF_COOKIE = "uudam_admin_handoff";
export const GOOGLE_COOKIE_PATH = "/api/admin/google";
const GOOGLE_STATE_TTL_SECONDS = 10 * 60;
export const GOOGLE_HANDOFF_TTL_SECONDS = 60;
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const PRODUCTION_ORIGIN = "https://uudamtravel.mn";

export type GoogleSignInError =
  | "google_not_configured"
  | "google_state_mismatch"
  | "google_cancelled"
  | "google_exchange_failed"
  | "google_token_invalid"
  | "google_email_unverified"
  | "google_email_not_allowed"
  | "google_handoff_missing";

export function parseAllowedEmails(raw: string | null | undefined): string[] {
  return (raw || "")
    .split(/[,\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes("@"));
}

export function allowedAdminEmails(): string[] {
  return parseAllowedEmails(process.env.ADMIN_GOOGLE_EMAILS);
}

/** A signing key anyone could guess would let them mint a session, so a weak one turns sign-in off. */
export function isStrongSecret(secret: string | null | undefined): boolean {
  const value = (secret || "").trim();
  return value.length >= 32 && new Set(value).size >= 10;
}

export function googleSignInAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.GOOGLE_CLIENT_ID?.trim() &&
      env.GOOGLE_CLIENT_SECRET?.trim() &&
      parseAllowedEmails(env.ADMIN_GOOGLE_EMAILS).length &&
      isStrongSecret(env.JWT_SECRET),
  );
}

/**
 * The origin Google returns to. Production always uses uudamtravel.mn, whichever host the person
 * started on (www, *.vercel.app), so the Google console needs exactly one production redirect URI
 * and the state cookie is always set and read on the same host.
 */
export function signInOrigin(req: Request, isProduction = process.env.NODE_ENV === "production"): string {
  if (isProduction) return PRODUCTION_ORIGIN;
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwardedHost || req.headers.get("host") || url.host;
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const proto = forwardedProto || url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export function googleRedirectUri(origin: string): string {
  return `${origin}${GOOGLE_COOKIE_PATH}/callback`;
}

export function newGoogleState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** Only an admin page of this site may be the landing spot — never an absolute or protocol-relative URL. */
export function safeAdminReturnPath(from: string | null | undefined): string {
  const value = (from || "").trim();
  if (/^\/[a-z]{2}\/admin(\/[A-Za-z0-9\-_/.]*)?(\?[^\s#]*)?$/.test(value) && !value.startsWith("//") && !value.includes("..")) {
    return value;
  }
  return "/mn/admin";
}

export function buildGoogleAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

function cookieAttributes(maxAgeSeconds: number, secure: boolean): string {
  // Lax, not Strict: the callback is a top-level navigation coming back from accounts.google.com.
  return `Path=${GOOGLE_COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
}

const isSecure = () => process.env.NODE_ENV === "production";

/** The state cookie also carries where to land afterwards: "<state>.<base64url(path)>". */
export function googleStateCookie(state: string, returnPath: string, secure = isSecure()): string {
  const value = `${state}.${Buffer.from(returnPath).toString("base64url")}`;
  return `${GOOGLE_STATE_COOKIE}=${value}; ${cookieAttributes(GOOGLE_STATE_TTL_SECONDS, secure)}`;
}

export function readGoogleStateCookie(raw: string | null | undefined): { state: string; returnPath: string } | null {
  const [state, encoded] = (raw || "").split(".");
  if (!state) return null;
  let path = "";
  try {
    path = encoded ? Buffer.from(encoded, "base64url").toString("utf8") : "";
  } catch {
    path = "";
  }
  return { state, returnPath: safeAdminReturnPath(path) };
}

export function handoffCookie(token: string, secure = isSecure()): string {
  return `${GOOGLE_HANDOFF_COOKIE}=${token}; ${cookieAttributes(GOOGLE_HANDOFF_TTL_SECONDS, secure)}`;
}

export function clearedCookie(name: string, secure = isSecure()): string {
  return `${name}=; ${cookieAttributes(0, secure)}`;
}

export function readCookie(req: Request, name: string): string {
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return "";
}

export function statesMatch(expected: string, actual: string): boolean {
  if (!expected || !actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type IdTokenClaims = { iss?: unknown; aud?: unknown; exp?: unknown; email?: unknown; email_verified?: unknown };

function decodeIdToken(idToken: string): IdTokenClaims | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as IdTokenClaims;
  } catch {
    return null;
  }
}

/**
 * Checks the ID token Google returned on the server-to-server code exchange (TLS straight from
 * Google, so its signature need not be re-verified) and the allow-list.
 */
export function checkGoogleIdToken(
  idToken: string,
  clientId: string,
  allowedEmails: string[],
  now = Date.now(),
): { ok: true; email: string } | { ok: false; error: GoogleSignInError } {
  const claims = decodeIdToken(idToken);
  if (!claims) return { ok: false, error: "google_token_invalid" };
  if (typeof claims.iss !== "string" || !GOOGLE_ISSUERS.has(claims.iss)) return { ok: false, error: "google_token_invalid" };
  if (claims.aud !== clientId) return { ok: false, error: "google_token_invalid" };
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) return { ok: false, error: "google_token_invalid" };
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!email) return { ok: false, error: "google_token_invalid" };
  if (claims.email_verified !== true && claims.email_verified !== "true") return { ok: false, error: "google_email_unverified" };
  if (!allowedEmails.includes(email)) return { ok: false, error: "google_email_not_allowed" };
  return { ok: true, email };
}

export async function exchangeGoogleCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string | null> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const json = (await res.json().catch(() => null)) as { id_token?: unknown } | null;
  return typeof json?.id_token === "string" ? json.id_token : null;
}
