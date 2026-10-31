import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { handler, httpError, json, readJson } from "@/server/http";
import { invalidateCatalog } from "@/server/cache";
import { LOCALES } from "@/lib/locales";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const expected = process.env.CHATBOT_SYNC_SECRET;
  const provided = req.headers.get("x-trip-sync-secret") || "";
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

const SLUG = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,199}$/u;

/**
 * The chatbot calls this after its projection rewrote trips here. Website
 * saves refresh their own pages; without this a chatbot edit stayed behind
 * the five-minute page cache while the bot already quoted the new facts.
 */
export const POST = handler(async (req: Request) => {
  if (!authorized(req)) throw httpError(401, "Unauthorized");
  const body = await readJson<{ slugs?: unknown }>(req);
  const slugs = (Array.isArray(body.slugs) ? body.slugs : [])
    .filter((slug): slug is string => typeof slug === "string" && SLUG.test(slug))
    .slice(0, 50);
  invalidateCatalog();
  for (const locale of LOCALES) {
    revalidatePath(`/${locale}`, "page");
    revalidatePath(`/${locale}/trips`, "page");
    revalidatePath(`/${locale}/departures`, "page");
    for (const slug of slugs) revalidatePath(`/${locale}/trips/${slug}`, "page");
  }
  revalidatePath("/[locale]/trips/[slug]", "page");
  revalidatePath("/[locale]/category/[id]", "page");
  return json({ ok: true, revalidated: slugs.length });
});
