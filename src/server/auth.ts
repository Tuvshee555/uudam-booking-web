import { prisma } from "./prisma";
import { httpError } from "./http";
import { signAccessToken, verifySessionToken } from "./session";

import type { AuthUser } from "./session";

export type { AuthUser };

/** Verifies the Bearer token and returns the caller. */
export function requireAuth(req: Request): AuthUser {
  const session = requireSession(req);
  return { id: session.id, role: session.role };
}

function requireSession(req: Request) {
  const auth = req.headers.get("authorization");

  if (!auth || !auth.startsWith("Bearer ")) {
    throw httpError(401, "Unauthorized");
  }

  const session = verifySessionToken(auth.slice("Bearer ".length));
  if (!session) throw httpError(401, "Нэвтрэх хугацаа дууссан. Google-ээр дахин нэвтэрнэ үү.");

  return session;
}

// Short-lived role cache: the admin dashboard fires many requests at once and
// shouldn't cost a DB round-trip per call. A revoked admin still loses access
// within ROLE_TTL_MS.
const ROLE_TTL_MS = 15_000;
const roleCache = new Map<string, { role: string | null; email: string | null; expires: number }>();

async function resolveStaff(userId: string) {
  const hit = roleCache.get(userId);
  if (hit && Date.now() < hit.expires) return hit;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });

  const entry = { role: user?.role ?? null, email: user?.email?.toLowerCase() ?? null, expires: Date.now() + ROLE_TTL_MS };
  roleCache.set(userId, entry);
  return entry;
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
  const user = requireSession(req);
  const { role, email } = await resolveStaff(user.id);

  // The row must be the same person Google vouched for, not just any id the token names.
  if ((role !== "ADMIN" && role !== "STAFF") || email !== user.email) {
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

export { signAccessToken, verifySessionToken };
