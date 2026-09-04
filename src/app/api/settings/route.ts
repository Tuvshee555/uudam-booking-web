import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, json, publicCache, readJson, safeText } from "@/server/http";
import { cached, invalidate } from "@/server/cache";

/**
 * GET /api/settings — public. Just the fields the storefront needs to render;
 * there is only one such field today.
 */
export const GET = handler(async () => {
  const settings = await cached("settings:default", 30_000, async () => {
    const row = await prisma.siteSettings.findUnique({ where: { id: "default" } });
    return { tripNotice: row?.tripNotice ?? null };
  });

  return publicCache(NextResponse.json(settings));
});

/** PUT /api/settings — admin. Upserts the single row so a first edit doesn't 404. */
export const PUT = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);
  const tripNotice = safeText(body.tripNotice, 2000);

  const row = await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: { id: "default", tripNotice },
    update: { tripNotice },
  });

  invalidate("settings");

  return json({ tripNotice: row.tripNotice });
});
