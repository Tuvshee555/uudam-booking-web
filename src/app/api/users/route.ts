import bcrypt from "bcryptjs";
import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, httpError, json, readJson, safeText } from "@/server/http";

/**
 * Staff accounts. There is no public signup — customers never have accounts,
 * so the only way in is an existing admin creating one.
 */
const STAFF_SELECT = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  phonenumber: true,
  createdAt: true,
} as const;

export const GET = handler(async (req: Request) => {
  await requireAdmin(req);

  const users = await prisma.user.findMany({
    select: STAFF_SELECT,
    orderBy: { createdAt: "asc" },
  });

  return json({ users });
});

export const POST = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);
  const email = safeText(body.email, 200)?.toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!email) throw httpError(400, "И-мэйл оруулна уу");
  if (password.length < 8) throw httpError(400, "Нууц үг дор хаяж 8 тэмдэгт байна");

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw httpError(400, "Энэ и-мэйл бүртгэлтэй байна");

  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 10),
      firstName: safeText(body.firstName, 120),
      lastName: safeText(body.lastName, 120),
      phonenumber: safeText(body.phonenumber, 40),
      role: body.role === "STAFF" ? "STAFF" : "ADMIN",
      isVerified: true,
    },
    select: STAFF_SELECT,
  });

  return json(user, { status: 201 });
});
