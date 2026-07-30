import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, httpError, json, readJson, safeText } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

const STATUSES = new Set(["NEW", "CONTACTED", "CONFIRMED", "COMPLETED", "CANCELLED"]);

/** PATCH /api/enquiries/:id — staff move it through the queue. */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin(req);
  const { id } = await ctx.params;

  const body = await readJson(req);
  const status = typeof body.status === "string" ? body.status.toUpperCase() : undefined;

  if (status && !STATUSES.has(status)) {
    throw httpError(400, "Статус буруу байна");
  }

  const notes = body.staffNotes === undefined ? undefined : safeText(body.staffNotes, 4000);

  if (status === undefined && notes === undefined) {
    throw httpError(400, "Өөрчлөх мэдээлэл алга");
  }

  const existing = await prisma.enquiry.findUnique({
    where: { id },
    select: { id: true, status: true, handledById: true },
  });

  if (!existing) throw httpError(404, "Хүсэлт олдсонгүй");

  const enquiry = await prisma.enquiry.update({
    where: { id },
    data: {
      ...(status ? { status: status as "NEW" } : {}),
      ...(notes === undefined ? {} : { staffNotes: notes }),
      // Whoever first moves it off NEW owns it, so the office can see who is
      // already on the phone to this person.
      ...(existing.status === "NEW" && status && status !== "NEW" && !existing.handledById
        ? { handledById: admin.id }
        : {}),
    },
    include: {
      trip: { select: { id: true, slug: true, title: true, image: true } },
      departure: { select: { id: true, startDate: true, label: true } },
      handledBy: { select: { id: true, firstName: true, email: true } },
    },
  });

  return json(enquiry);
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;

  await prisma.enquiry.delete({ where: { id } }).catch(() => {
    throw httpError(404, "Хүсэлт олдсонгүй");
  });

  return json({ success: true });
});
