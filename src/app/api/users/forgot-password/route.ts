import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@/server/prisma";
import { clientIp, handler, httpError, json, rateLimit, readJson, safeText } from "@/server/http";
import { sendEmail } from "@/server/mail";
import { passwordResetEmail } from "@/server/emailTemplates";

const RESET_TTL_MS = 15 * 60 * 1000;

/** POST /api/users/forgot-password */
export const POST = handler(async (req: Request) => {
  rateLimit(`forgot:${clientIp(req)}`, { windowMs: 15 * 60 * 1000, max: 5 });

  const body = await readJson(req);
  const email = safeText(body.email, 200)?.toLowerCase();

  // The response is identical whether or not the account exists, so this
  // endpoint can't be used to find out who has an account.
  const genericResponse = {
    message: "Хэрэв ийм бүртгэл байгаа бол сэргээх холбоос илгээгдлээ",
  };

  if (!email) return json(genericResponse);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) return json(genericResponse);

  const secret = process.env.JWT_SECRET;
  if (!secret) throw httpError(500, "Auth not configured");

  const resetToken = jwt.sign({ id: user.id, type: "reset" }, secret, { expiresIn: "15m" });

  // Only a hash is stored, so the token works exactly once even though the JWT
  // itself would stay valid for its full lifetime.
  const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: tokenHash, resetTokenExpiry: new Date(Date.now() + RESET_TTL_MS) },
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.FRONTEND_URL ||
    new URL(req.url).origin;

  await sendEmail({
    to: user.email,
    subject: "Нууц үг сэргээх — Uudam Travel",
    html: passwordResetEmail(`${baseUrl}/mn/admin/reset-password?token=${resetToken}`),
  }).catch((err) => console.error("Reset email failed:", err));

  return json(genericResponse);
});
