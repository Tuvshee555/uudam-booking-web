import { timingSafeEqual } from "node:crypto";
import { handler, httpError, json, readJson } from "@/server/http";
import { revalidateTrips } from "@/server/revalidate";
import { menuChangedSinceRender } from "@/server/siteNavCache";

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
 * saves refresh their own pages; without this a chatbot edit would wait for
 * the daily page refresh while the bot already quotes the new facts.
 *
 * Only the named trips and the lists are refreshed, like a website save. The
 * chatbot can also publish, withdraw or recategorise a trip, which moves the
 * menu on every page; that is checked against the menu the pages were built
 * with, and then everything is refreshed. No slugs (an older chatbot, or an
 * unknown change) also refreshes everything.
 */
export const POST = handler(async (req: Request) => {
  if (!authorized(req)) throw httpError(401, "Unauthorized");
  const body = await readJson<{ slugs?: unknown }>(req);
  const slugs = (Array.isArray(body.slugs) ? body.slugs : [])
    .filter((slug): slug is string => typeof slug === "string" && SLUG.test(slug))
    .slice(0, 50);
  const menuChanged = !slugs.length || (await menuChangedSinceRender());
  revalidateTrips(slugs, { menuChanged });
  return json({ ok: true, revalidated: slugs.length, everything: menuChanged });
});
