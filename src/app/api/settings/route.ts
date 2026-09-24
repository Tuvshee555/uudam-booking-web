import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, json, publicCache, readJson, safeText } from "@/server/http";
import { cached, invalidate } from "@/server/cache";
import { parseAboutValues } from "@/lib/aboutContent";
import { parseFaqs, parseTermsSections } from "@/lib/siteContent";

/**
 * GET /api/settings — public. Just the fields the storefront needs to render.
 */
export const GET = handler(async () => {
  const settings = await cached("settings:default", 30_000, async () => {
    const row = await prisma.siteSettings.findUnique({ where: { id: "default" } });
    return {
      tripNotice: row?.tripNotice ?? null,
      bankDetails: row?.bankDetails ?? null,
      aboutHeroTitle: row?.aboutHeroTitle ?? null,
      aboutHeroSubtitle: row?.aboutHeroSubtitle ?? null,
      aboutValues: row?.aboutValues ?? null,
      homeHeroTitle: row?.homeHeroTitle ?? null,
      homeHeroTitleAccent: row?.homeHeroTitleAccent ?? null,
      homeHeroSubtitle: row?.homeHeroSubtitle ?? null,
      homeCustomCtaTitle: row?.homeCustomCtaTitle ?? null,
      homeCustomCtaBody: row?.homeCustomCtaBody ?? null,
      customTripTitle: row?.customTripTitle ?? null,
      customTripBody: row?.customTripBody ?? null,
      giftTitle: row?.giftTitle ?? null,
      giftBody: row?.giftBody ?? null,
      faqs: row?.faqs ?? null,
      termsSections: row?.termsSections ?? null,
    };
  });

  return publicCache(NextResponse.json(settings));
});

/** PUT /api/settings — admin. Upserts the single row so a first edit doesn't 404. */
export const PUT = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);

  const tripNotice = safeText(body.tripNotice, 2000);
  const bankDetails = safeText(body.bankDetails, 2000);

  const aboutHeroTitle = safeText(body.aboutHeroTitle, 300);
  const aboutHeroSubtitle = safeText(body.aboutHeroSubtitle, 600);
  const aboutValues =
    body.aboutValues === undefined ? undefined : (parseAboutValues(body.aboutValues) ?? Prisma.JsonNull);

  const homeHeroTitle = safeText(body.homeHeroTitle, 200);
  const homeHeroTitleAccent = safeText(body.homeHeroTitleAccent, 200);
  const homeHeroSubtitle = safeText(body.homeHeroSubtitle, 400);

  const homeCustomCtaTitle = safeText(body.homeCustomCtaTitle, 200);
  const homeCustomCtaBody = safeText(body.homeCustomCtaBody, 600);
  const customTripTitle = safeText(body.customTripTitle, 200);
  const customTripBody = safeText(body.customTripBody, 800);

  const giftTitle = safeText(body.giftTitle, 200);
  const giftBody = safeText(body.giftBody, 800);

  const faqs = body.faqs === undefined ? undefined : (parseFaqs(body.faqs) ?? Prisma.JsonNull);
  const termsSections =
    body.termsSections === undefined ? undefined : (parseTermsSections(body.termsSections) ?? Prisma.JsonNull);

  const data = {
    tripNotice,
    bankDetails,
    aboutHeroTitle,
    aboutHeroSubtitle,
    aboutValues,
    homeHeroTitle,
    homeHeroTitleAccent,
    homeHeroSubtitle,
    homeCustomCtaTitle,
    homeCustomCtaBody,
    customTripTitle,
    customTripBody,
    giftTitle,
    giftBody,
    faqs,
    termsSections,
  };

  const row = await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });

  invalidate("settings");

  return json({
    tripNotice: row.tripNotice,
    bankDetails: row.bankDetails,
    aboutHeroTitle: row.aboutHeroTitle,
    aboutHeroSubtitle: row.aboutHeroSubtitle,
    aboutValues: row.aboutValues,
    homeHeroTitle: row.homeHeroTitle,
    homeHeroTitleAccent: row.homeHeroTitleAccent,
    homeHeroSubtitle: row.homeHeroSubtitle,
    homeCustomCtaTitle: row.homeCustomCtaTitle,
    homeCustomCtaBody: row.homeCustomCtaBody,
    customTripTitle: row.customTripTitle,
    customTripBody: row.customTripBody,
    giftTitle: row.giftTitle,
    giftBody: row.giftBody,
    faqs: row.faqs,
    termsSections: row.termsSections,
  });
});
