import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/prisma";
import { clientIp, handler, httpError, json, rateLimit, readJson } from "@/server/http";

/** POST /api/users/reset-password */
export const POST = handler(async (req: Request) => {
  rateLimit(`reset:${clientIp(req)}`, { windowMs: 15 * 60 * 1000, max: 10 });

  const body = await readJson(req);
  const token = typeof body.token === "string" ? body.token : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!token || !newPassword) throw httpError(400, "Token болон шинэ нууц үг шаардлагатай");
  if (newPassword.length < 8) throw httpError(400, "Нууц үг дор хаяж 8 тэмдэгт байна");

  const secret = process.env.JWT_SECRET;
  if (!secret) throw httpError(500, "Auth not configured");

  let decoded: { id?: string; type?: string };
  try {
    decoded = jwt.verify(token, secret) as { id?: string; type?: string };
  } catch {
    throw httpError(400, "Холбоос хүчингүй эсвэл хугацаа дууссан");
  }

  if (decoded?.type !== "reset" || !decoded?.id) {
    throw httpError(400, "Холбоос хүчингүй эсвэл хугацаа дууссан");
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user) throw httpError(400, "Холбоос хүчингүй эсвэл хугацаа дууссан");

  // Single-use enforcement: the stored hash must still match and not be expired.
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const notExpired =
    user.resetTokenExpiry && new Date(user.resetTokenExpiry).getTime() > Date.now();

  if (!user.resetToken || user.resetToken !== tokenHash || !notExpired) {
    throw httpError(400, "Холбоос хүчингүй эсвэл хугацаа дууссан");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(newPassword, 10),
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  return json({ message: "Нууц үг амжилттай солигдлоо" });
});
