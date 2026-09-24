import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, json, publicCache, readJson, safeText } from "@/server/http";
import { cached, invalidate } from "@/server/cache";
import { parseAboutValues } from "@/lib/aboutContent";

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
  const parsedAboutValues = parseAboutValues(body.aboutValues);
  const aboutValues =
    body.aboutValues === undefined
      ? undefined
      : (parsedAboutValues ?? Prisma.JsonNull);

  const data = { tripNotice, bankDetails, aboutHeroTitle, aboutHeroSubtitle, aboutValues };

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
  });
});
