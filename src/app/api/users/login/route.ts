import bcrypt from "bcryptjs";
import { prisma } from "@/server/prisma";
import { signAccessToken } from "@/server/auth";
import { clientIp, handler, httpError, json, rateLimit, readJson, safeText } from "@/server/http";

/** POST /api/users/login */
export const POST = handler(async (req: Request) => {
  rateLimit(`login:${clientIp(req)}`, { windowMs: 15 * 60 * 1000, max: 20 });

  const body = await readJson(req);
  const email = safeText(body.email, 200)?.toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) throw httpError(400, "И-мэйл болон нууц үг шаардлагатай");

  const user = await prisma.user.findUnique({ where: { email } });

  // Same message and roughly the same work for "no such user" and "wrong
  // password", so the response can't be used to enumerate accounts.
  const stored = user?.password;
  const matches = stored ? await bcrypt.compare(password, stored) : false;

  if (!user || !matches) {
    throw httpError(400, "И-мэйл эсвэл нууц үг буруу байна");
  }

  // No `role` gate here on purpose: this User table has no customer rows at
  // all (customers never sign in — see schema.prisma), so ADMIN and STAFF are
  // the only two rows that can ever exist here. Both get a session; what they
  // can do with it is requireAdmin()'s job, not login's.
  const token = signAccessToken({ id: user.id, role: user.role, email: user.email });

  return json({
    success: true,
    token,
    user: { id: user.id, email: user.email, role: user.role },
  });
});
