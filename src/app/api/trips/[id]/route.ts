import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { optionalAdmin, requireAdmin } from "@/server/auth";
import { handler, httpError, json, publicCache, readJson, safeText } from "@/server/http";
import { invalidateCatalog } from "@/server/cache";
import { assertChatbotTripSyncConfigured, deleteTripFromChatbot, syncTripToChatbot } from "@/server/chatbotTripSync";
import { saveDepartures } from "@/server/saveDepartures";
import {
  TRIP_INCLUDE,
  normalizeDepartures,
  normalizeItinerary,
  reconcilePricing,
  slugify,
  toDifficulty,
  toOptionalBoolean,
  toOptionalInt,
  toMediaJson,
  toOptionalJsonObject,
  toOptionalNumber,
  toStringArray,
  toTagSet,
  toVideoUrl,
  toVideoUrls,
  uniqueSlug,
} from "@/server/tripInput";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Trips are addressable by either uuid or slug so the storefront can use
 * readable URLs while the admin panel keeps working off ids.
 */
async function findTrip(idOrSlug: string) {
  return prisma.trip.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      ...TRIP_INCLUDE,
      testimonials: {
        where: { isPublished: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

function revalidateTripPages(slug: string) {
  for (const locale of ["mn", "en", "ko"]) {
    revalidatePath(`/${locale}`, "page");
    revalidatePath(`/${locale}/trips`, "page");
    revalidatePath(`/${locale}/trips/${slug}`, "page");
    revalidatePath(`/${locale}/departures`, "page");
  }
}

export const GET = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;

  const trip = await findTrip(id);
  if (!trip) throw httpError(404, "Аялал олдсонгүй");

  // A draft is only visible to staff — same 404 as "doesn't exist" for anyone
  // else, so a hidden trip can't be enumerated by a stranger with the link.
  if (!trip.isPublished) {
    const admin = await optionalAdmin(req);
    if (!admin) throw httpError(404, "Аялал олдсонгүй");
    return json(trip);
  }

  return publicCache(NextResponse.json(trip));
});

export const PUT = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin(req);
  assertChatbotTripSyncConfigured();

  const { id } = await ctx.params;
  const body = await readJson(req);

  const existing = await prisma.trip.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true, sourceTripId: true },
  });
  if (!existing) throw httpError(404, "Аялал олдсонгүй");

  const { price, oldPrice, discount } = reconcilePricing(body);

  const title = typeof body.title === "string" && body.title.trim()
    ? body.title.trim().slice(0, 300)
    : undefined;

  // Only re-slug when the admin explicitly edits the slug. Re-deriving it from
  // a renamed title would silently break every link the agency has already
  // shared on Facebook.
  const slug =
    typeof body.slug === "string" && body.slug.trim() && slugify(body.slug) !== existing.slug
      ? await uniqueSlug(slugify(body.slug), existing.id)
      : undefined;
  // Every website trip receives a stable canonical id. Older website-only
  // records acquire one on their next save instead of remaining invisible to
  // the chatbot and poster forever.
  const sourceTripId = existing.sourceTripId || `trip-web-${existing.id}`;

  // image is the one field that must never go blank: a photo-led catalog
  // shouldn't be able to publish (or be edited into) a trip with no cover.
  if (body.image !== undefined && !safeText(body.image, 800)) {
    throw httpError(400, "Зураг хоосон байж болохгүй");
  }

  const optionalText = (value: unknown, max: number) =>
    value === undefined ? undefined : safeText(value, max);

  const optionalArray = (value: unknown) =>
    value === undefined ? undefined : toStringArray(value);

  const trip = await prisma.$transaction(async (tx) => {
    if (Array.isArray(body.itinerary)) {
      await tx.itineraryDay.deleteMany({ where: { tripId: id } });
    }

    if (Array.isArray(body.departures)) {
      await saveDepartures(tx, id, normalizeDepartures(body.departures));
    }

    return tx.trip.update({
      where: { id },
      data: {
        title,
        ...(slug ? { slug } : {}),
        summary: optionalText(body.summary, 400),
        description:
          body.description === undefined ? undefined : (safeText(body.description, 20_000) ?? ""),

        country: optionalText(body.country, 120),
        city: optionalText(body.city, 120),
        region: optionalText(body.region, 120),
        destinations: optionalArray(body.destinations),
        meetingPoint: optionalText(body.meetingPoint, 400),
        latitude: body.latitude === undefined ? undefined : (toOptionalNumber(body.latitude) ?? null),
        longitude:
          body.longitude === undefined ? undefined : (toOptionalNumber(body.longitude) ?? null),
        mapUrl: optionalText(body.mapUrl, 800),

        durationDays: toOptionalInt(body.durationDays),
        durationNights: toOptionalInt(body.durationNights),
        minTravelers: toOptionalInt(body.minTravelers),
        maxTravelers:
          body.maxTravelers === undefined ? undefined : (toOptionalInt(body.maxTravelers) ?? null),
        difficulty: toDifficulty(body.difficulty),
        transport: optionalArray(body.transport),
        languages: optionalArray(body.languages),
        season: optionalText(body.season, 120),

        highlights: optionalArray(body.highlights),
        included: optionalArray(body.included),
        excluded: optionalArray(body.excluded),
        requirements: optionalText(body.requirements, 4000),
        cancellationPolicy: optionalText(body.cancellationPolicy, 4000),
        importantNotes: optionalArray(body.importantNotes),

        image: body.image === undefined ? undefined : (safeText(body.image, 800) ?? undefined),
        extraImages: optionalArray(body.extraImages),
        video: toVideoUrl(body.video),
        videos: toVideoUrls(body.videos),
        hotelMedia: toMediaJson(body.hotelMedia),
        travelerMedia: toMediaJson(body.travelerMedia),

        price,
        oldPrice: body.oldPrice === undefined ? undefined : (oldPrice ?? null),
        discount,
        childPrice:
          body.childPrice === undefined ? undefined : (toOptionalNumber(body.childPrice) ?? null),
        infantPrice:
          body.infantPrice === undefined ? undefined : (toOptionalNumber(body.infantPrice) ?? null),
        singleSupplement:
          body.singleSupplement === undefined
            ? undefined
            : (toOptionalNumber(body.singleSupplement) ?? null),
        sourceTripId,
        sourceMetadata: toOptionalJsonObject(body.sourceMetadata) as Prisma.InputJsonValue | undefined,
        hotel: optionalText(body.hotel, 400),
        foodIncluded: toOptionalBoolean(body.foodIncluded),
        departureRule: optionalText(body.departureRule, 1000),
        extraFees: optionalArray(body.extraFees),
        roomPrices: optionalArray(body.roomPrices),
        childPriceNotes: optionalArray(body.childPriceNotes),
        brochurePdfUrl: optionalText(body.brochurePdfUrl, 1000),

        categoryId: body.categoryId === undefined ? undefined : safeText(body.categoryId, 60),
        isFeatured: typeof body.isFeatured === "boolean" ? body.isFeatured : undefined,
        isPublished: typeof body.isPublished === "boolean" ? body.isPublished : undefined,
        salesCount: toOptionalInt(body.salesCount),
        tags: body.tagIds === undefined ? undefined : toTagSet(body.tagIds),

        ...(Array.isArray(body.itinerary)
          ? { itinerary: { create: normalizeItinerary(body.itinerary) } }
          : {}),
      },
      include: TRIP_INCLUDE,
    });
  }, { timeout: 15_000 });

  await syncTripToChatbot(trip);
  invalidateCatalog();
  revalidatePath("/[locale]/trips/[slug]", "page");
  revalidatePath("/[locale]/departures", "page");
  revalidatePath("/[locale]/trips", "page");

  return json(trip);
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin(req);
  assertChatbotTripSyncConfigured();

  const { id } = await ctx.params;
  const source = await prisma.trip.findUnique({
    where: { id },
    select: { sourceTripId: true, slug: true },
  });
  if (!source) throw httpError(404, "Аялал олдсонгүй");

  const bookings = await prisma.booking.count({ where: { tripId: id } });

  if (bookings > 0) {
    // Bookings keep a required trip relation, so these rows cannot be hard
    // deleted without damaging payment/traveler history. Enquiries are safe:
    // their trip relation is optional and becomes null on delete.
    const trip = await prisma.trip.update({
      where: { id },
      data: { isPublished: false, isFeatured: false },
      include: TRIP_INCLUDE,
    });

    await syncTripToChatbot(trip);

    invalidateCatalog();
    revalidateTripPages(source.slug);

    return json({
      success: true,
      archived: true,
      message: "Захиалгатай аялал тул нийтээс нуув (устгаагүй).",
    });
  }

  await deleteTripFromChatbot(source.sourceTripId);
  // The canonical delete may already have removed this unbooked website row
  // during its return sync. deleteMany keeps this endpoint idempotent.
  await prisma.trip.deleteMany({ where: { id } });
  invalidateCatalog();
  revalidateTripPages(source.slug);

  return json({ success: true, archived: false });
});
