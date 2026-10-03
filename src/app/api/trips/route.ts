import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma, withPrismaRetry } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, json, publicCache, readJson, safeText } from "@/server/http";
import { cached, invalidateCatalog } from "@/server/cache";
import { assertChatbotTripSyncConfigured, syncTripToChatbot } from "@/server/chatbotTripSync";
import {
  TRIP_INCLUDE,
  assertTitle,
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
  toCategoryConnect,
  toTagConnect,
  toVideoUrl,
  toVideoUrls,
  uniqueSlug,
} from "@/server/tripInput";

/** GET /api/trips — public catalog. */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const categoryId = url.searchParams.get("category");
  const featured = url.searchParams.get("featured");
  const search = url.searchParams.get("search")?.trim();
  const includeUnpublished = url.searchParams.get("all") === "true";

  // Admin list views ask for everything, including drafts; that response is
  // user-specific enough that it must not be cached or CDN-shared.
  if (includeUnpublished) {
    await requireAdmin(req);

    const trips = await prisma.trip.findMany({
      include: TRIP_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return json(trips);
  }

  const key = `trips:list:${categoryId ?? "all"}:${featured ?? "0"}:${search ?? ""}`;

  const trips = await cached(key, 20_000, () =>
    withPrismaRetry(() =>
      prisma.trip.findMany({
        where: {
          isPublished: true,
          ...(categoryId
            ? { OR: [{ categoryId }, { categories: { some: { id: categoryId } } }] }
            : {}),
          ...(featured === "true" ? { isFeatured: true } : {}),
          ...(search
            ? {
                OR: [
                  { title: { contains: search, mode: "insensitive" as const } },
                  { summary: { contains: search, mode: "insensitive" as const } },
                  { country: { contains: search, mode: "insensitive" as const } },
                  { city: { contains: search, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        include: TRIP_INCLUDE,
        orderBy: { createdAt: "desc" },
      }),
    ),
  );

  return publicCache(NextResponse.json(trips));
});

/** POST /api/trips — create a trip (admin). */
export const POST = handler(async (req: Request) => {
  await requireAdmin(req);
  assertChatbotTripSyncConfigured();

  const body = await readJson(req);
  const title = assertTitle(body.title);

  const { price, oldPrice, discount } = reconcilePricing(body);

  if (price === undefined) {
    throw Object.assign(new Error("Үнэ оруулна уу"), { status: 400 });
  }

  const image = safeText(body.image, 800);
  if (!image) {
    throw Object.assign(new Error("Зураг оруулна уу"), { status: 400 });
  }

  const slug = await uniqueSlug(
    typeof body.slug === "string" && body.slug.trim()
      ? slugify(body.slug)
      : slugify(title),
  );

  const sourceTripId = safeText(body.sourceTripId, 120) || `trip-web-${crypto.randomUUID()}`;
  const categoryIds = Array.isArray(body.categoryIds)
    ? body.categoryIds.filter((entry: unknown): entry is string => typeof entry === "string" && entry.length > 0)
    : (safeText(body.categoryId, 60) ? [safeText(body.categoryId, 60)!] : []);
  const trip = await prisma.trip.create({
    data: {
      title,
      slug,
      summary: safeText(body.summary, 400),
      description: safeText(body.description, 20_000) ?? "",

      country: safeText(body.country, 120),
      city: safeText(body.city, 120),
      region: safeText(body.region, 120),
      destinations: toStringArray(body.destinations),
      meetingPoint: safeText(body.meetingPoint, 400),
      latitude: toOptionalNumber(body.latitude) ?? null,
      longitude: toOptionalNumber(body.longitude) ?? null,
      mapUrl: safeText(body.mapUrl, 800),

      durationDays: toOptionalInt(body.durationDays) ?? 1,
      durationNights: toOptionalInt(body.durationNights) ?? 0,
      minTravelers: toOptionalInt(body.minTravelers) ?? 1,
      maxTravelers: toOptionalInt(body.maxTravelers) ?? null,
      difficulty: toDifficulty(body.difficulty) ?? "EASY",
      transport: toStringArray(body.transport),
      languages: toStringArray(body.languages),
      season: safeText(body.season, 120),

      highlights: toStringArray(body.highlights),
      included: toStringArray(body.included),
      excluded: toStringArray(body.excluded),
      requirements: safeText(body.requirements, 4000),
      cancellationPolicy: safeText(body.cancellationPolicy, 4000),
      importantNotes: toStringArray(body.importantNotes, 80),

      image,
      extraImages: toStringArray(body.extraImages),
      video: toVideoUrl(body.video) ?? null,
      videos: toVideoUrls(body.videos) ?? [],
      hotelMedia: toMediaJson(body.hotelMedia),
      travelerMedia: toMediaJson(body.travelerMedia),

      price,
      oldPrice: oldPrice ?? null,
      discount: discount ?? 0,
      childPrice: toOptionalNumber(body.childPrice) ?? null,
      infantPrice: toOptionalNumber(body.infantPrice) ?? null,
      singleSupplement: toOptionalNumber(body.singleSupplement) ?? null,
      sourceTripId,
      sourceMetadata: toOptionalJsonObject(body.sourceMetadata) as Prisma.InputJsonValue | undefined,
      hotel: safeText(body.hotel, 400),
      foodIncluded: toOptionalBoolean(body.foodIncluded) ?? null,
      departureRule: safeText(body.departureRule, 1000),
      extraFees: toStringArray(body.extraFees, 80),
      roomPrices: toStringArray(body.roomPrices, 120),
      childPriceNotes: toStringArray(body.childPriceNotes, 80),
      brochurePdfUrl: safeText(body.brochurePdfUrl, 1000),

      categoryId: categoryIds[0] ?? null,
      isFeatured: Boolean(body.isFeatured),
      isPublished: body.isPublished === undefined ? true : Boolean(body.isPublished),

      categories: toCategoryConnect(categoryIds),
      tags: toTagConnect(body.tagIds),
      itinerary: { create: normalizeItinerary(body.itinerary) },
      departures: { create: normalizeDepartures(body.departures) },
    },
    include: TRIP_INCLUDE,
  });

  await syncTripToChatbot(trip);

  invalidateCatalog();

  return json(trip, { status: 201 });
});
