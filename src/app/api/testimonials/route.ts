import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, httpError, json, readJson, safeText } from "@/server/http";
import { invalidateCatalog } from "@/server/cache";
import { recomputeTripRating, toOptionalDate, toOptionalInt, toStringArray } from "@/server/tripInput";

/**
 * Staff-entered customer feedback — there are no customer accounts, so this
 * can't be a self-service review form. Every mutation recomputes the parent
 * trip's avgRating/reviewCount so the summary number on the card never drifts
 * from the testimonials actually shown on the trip page.
 */

const TESTIMONIAL_SELECT = {
  id: true,
  tripId: true,
  authorName: true,
  rating: true,
  comment: true,
  images: true,
  travelDate: true,
  isPublished: true,
  createdAt: true,
  trip: { select: { id: true, slug: true, title: true } },
} as const;

/** Admin-only list, across every trip (or one, via ?tripId=). */
export const GET = handler(async (req: Request) => {
  await requireAdmin(req);

  const tripId = new URL(req.url).searchParams.get("tripId");

  const testimonials = await prisma.testimonial.findMany({
    where: tripId ? { tripId } : {},
    select: TESTIMONIAL_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return json(testimonials);
});

export const POST = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);
  const authorName = safeText(body.authorName, 120);
  const comment = safeText(body.comment, 4000);
  const tripId = safeText(body.tripId, 60);

  if (!authorName) throw httpError(400, "Нэрийг оруулна уу");
  if (!comment) throw httpError(400, "Сэтгэгдэл оруулна уу");

  const rating = Math.min(5, Math.max(1, toOptionalInt(body.rating) ?? 5));

  if (tripId) {
    const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { id: true } });
    if (!trip) throw httpError(400, "Аялал олдсонгүй");
  }

  const testimonial = await prisma.testimonial.create({
    data: {
      tripId: tripId || null,
      authorName,
      comment,
      rating,
      images: toStringArray(body.images),
      travelDate: toOptionalDate(body.travelDate) ?? null,
      isPublished: body.isPublished === undefined ? true : Boolean(body.isPublished),
    },
    select: TESTIMONIAL_SELECT,
  });

  if (testimonial.tripId) await recomputeTripRating(testimonial.tripId);
  invalidateCatalog();

  return json(testimonial, { status: 201 });
});

export const PUT = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);
  const id = safeText(body.id, 60);
  if (!id) throw httpError(400, "ID шаардлагатай");

  const existing = await prisma.testimonial.findUnique({ where: { id }, select: { tripId: true } });
  if (!existing) throw httpError(404, "Сэтгэгдэл олдсонгүй");

  const rating = body.rating === undefined ? undefined : Math.min(5, Math.max(1, toOptionalInt(body.rating) ?? 5));

  const testimonial = await prisma.testimonial.update({
    where: { id },
    data: {
      authorName: body.authorName === undefined ? undefined : (safeText(body.authorName, 120) ?? undefined),
      comment: body.comment === undefined ? undefined : (safeText(body.comment, 4000) ?? undefined),
      rating,
      images: body.images === undefined ? undefined : toStringArray(body.images),
      travelDate: body.travelDate === undefined ? undefined : (toOptionalDate(body.travelDate) ?? null),
      isPublished: typeof body.isPublished === "boolean" ? body.isPublished : undefined,
    },
    select: TESTIMONIAL_SELECT,
  });

  if (testimonial.tripId) await recomputeTripRating(testimonial.tripId);
  invalidateCatalog();

  return json(testimonial);
});

export const DELETE = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);
  const id = safeText(body.id, 60);
  if (!id) throw httpError(400, "ID шаардлагатай");

  const testimonial = await prisma.testimonial.delete({ where: { id }, select: { tripId: true } });

  if (testimonial.tripId) await recomputeTripRating(testimonial.tripId);
  invalidateCatalog();

  return json({ success: true });
});
