import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { allowedAdminEmails } from "@/server/googleAuth";
import { handler, json } from "@/server/http";

/**
 * Who can get into the admin panel. Sign-in is Google-only and ADMIN_GOOGLE_EMAILS (Vercel env)
 * is the whole list — there are no passwords and no in-app way to add a person, so a stolen
 * session can't grant itself or anyone else access. Staff rows only record who handled what.
 */
const STAFF_SELECT = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  phonenumber: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const GET = handler(async (req: Request) => {
  await requireAdmin(req);

  const allowed = allowedAdminEmails();
  const users = await prisma.user.findMany({
    select: STAFF_SELECT,
    orderBy: { createdAt: "asc" },
  });

  return json({
    allowedEmails: allowed,
    users: users.map((user) => ({ ...user, canSignIn: allowed.includes(user.email.toLowerCase()) })),
  });
});

export const POST = handler(async (req: Request) => {
  await requireAdmin(req);
  return json(
    { message: "Шинэ хүн нэмэхдээ түүний Gmail хаягийг ADMIN_GOOGLE_EMAILS жагсаалтад нэмнэ (хөгжүүлэгч)." },
    { status: 410 },
  );
});
