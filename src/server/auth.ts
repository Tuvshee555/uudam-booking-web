import jwt from "jsonwebtoken";
import { prisma } from "./prisma";
import { httpError } from "./http";

export type AuthUser = { id: string; role: "STAFF" | "ADMIN" };

/**
 * Verifies the Bearer token and returns the caller. Replaces the Express
 * `requireAuth` middleware.
 *
 * Password-reset tokens are rejected here: a reset link travels through email,
 * browser history and Referer headers, so it must never be replayable as an
 * API credential.
 */
export function requireAuth(req: Request): AuthUser {
  const auth = req.headers.get("authorization");

  if (!auth || !auth.startsWith("Bearer ")) {
    throw httpError(401, "Unauthorized");
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET is not set; refusing to process auth");
    throw httpError(500, "Auth misconfiguration");
  }

  const token = auth.slice("Bearer ".length);

  let decoded: Record<string, unknown>;
  try {
    decoded = jwt.verify(token, secret) as Record<string, unknown>;
  } catch {
    throw httpError(401, "Invalid token");
  }

  if (decoded?.type && decoded.type !== "access") {
    throw httpError(401, "Invalid token");
  }

  const userId =
    (decoded?.id as string) ??
    (decoded?.userId as string) ??
    (decoded?.user_id as string) ??
    null;

  if (!userId) {
    throw httpError(401, "Invalid token: missing user id");
  }

  const role = (decoded?.role as string) === "ADMIN" ? "ADMIN" : "STAFF";

  return { id: userId, role };
}

// Short-lived role cache: the admin dashboard fires many requests at once and
// shouldn't cost a DB round-trip per call. A revoked admin still loses access
// within ROLE_TTL_MS.
const ROLE_TTL_MS = 15_000;
const roleCache = new Map<string, { role: string | null; expires: number }>();

async function resolveRole(userId: string) {
  const hit = roleCache.get(userId);
  if (hit && Date.now() < hit.expires) return hit.role;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const role = user?.role ?? null;
  roleCache.set(userId, { role, expires: Date.now() + ROLE_TTL_MS });
  return role;
}

/**
 * Authenticates, then confirms the caller is still a staff row in the
 * database rather than trusting the JWT claim — a removed account loses
 * access in seconds instead of keeping rights until their long-lived token
 * expires.
 *
 * Named `requireAdmin` for historical reasons, but it accepts both ADMIN and
 * STAFF: this is a small agency with one shared trust tier, not a
 * fine-grained permission system, and there is no customer role in this User
 * table to guard against in the first place.
 */
export async function requireAdmin(req: Request): Promise<AuthUser> {
  const user = requireAuth(req);
  const role = await resolveRole(user.id);

  if (role !== "ADMIN" && role !== "STAFF") {
    throw httpError(403, "Admin access required");
  }

  return { id: user.id, role: role as "ADMIN" | "STAFF" };
}

/** Same check as requireAdmin, but returns null instead of throwing. */
export async function optionalAdmin(req: Request): Promise<AuthUser | null> {
  try {
    return await requireAdmin(req);
  } catch {
    return null;
  }
}

export function signAccessToken(payload: { id: string; role: string; email?: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw httpError(500, "Auth misconfiguration");

  return jwt.sign({ ...payload, type: "access" }, secret, { expiresIn: "7d" });
}
