import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { optionalAdmin, requireAdmin } from "@/server/auth";
import { handler, httpError, json, publicCache, readJson, safeText } from "@/server/http";
import { slugify } from "@/server/tripInput";
import { uniqueKnowledgeSlug } from "../route";

type Ctx = { params: Promise<{ id: string }> };

function toStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 300))
    .slice(0, max);
}

/** Addressable by id (admin) or slug (storefront), same as trips/posts. */
function findArticle(idOrSlug: string) {
  return prisma.knowledgeArticle.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } });
}

export const GET = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;

  const article = await findArticle(id);
  if (!article) throw httpError(404, "Мэдээлэл олдсонгүй");

  // A draft is a 404 to everyone but staff, so an unfinished piece can't be
  // read by anyone who guesses the link.
  if (!article.isPublished) {
    const admin = await optionalAdmin(req);
    if (!admin) throw httpError(404, "Мэдээлэл олдсонгүй");
    return json(article);
  }

  return publicCache(NextResponse.json(article));
});

export const PUT = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin(req);

  const { id } = await ctx.params;
  const body = await readJson(req);

  const existing = await prisma.knowledgeArticle.findUnique({
    where: { id },
    select: { id: true, slug: true, isPublished: true, publishedAt: true },
  });
  if (!existing) throw httpError(404, "Мэдээлэл олдсонгүй");

  const title = safeText(body.title, 300);
  const text = safeText(body.body, 50_000);
  const facts = body.facts === undefined ? undefined : toStringArray(body.facts, 40);

  const requestedSlug = safeText(body.slug, 200);
  const slug =
    requestedSlug && requestedSlug !== existing.slug
      ? await uniqueKnowledgeSlug(slugify(requestedSlug, "knowledge"), existing.id)
      : undefined;

  const isPublished = typeof body.isPublished === "boolean" ? body.isPublished : undefined;

  const article = await prisma.knowledgeArticle.update({
    where: { id },
    data: {
      ...(title ? { title } : {}),
      body: text,
      ...(facts === undefined ? {} : { facts }),
      ...(slug ? { slug } : {}),
      excerpt: safeText(body.excerpt, 500),
      coverImage: safeText(body.coverImage, 500),
      video: safeText(body.video, 500),
      ...(isPublished === undefined ? {} : { isPublished }),
      // Stamp publishedAt the first time it goes live and never move it after,
      // so editing a published piece doesn't jump it back to the top.
      ...(isPublished && !existing.publishedAt ? { publishedAt: new Date() } : {}),
    },
  });

  return json(article);
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin(req);

  const { id } = await ctx.params;

  const existing = await prisma.knowledgeArticle.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw httpError(404, "Мэдээлэл олдсонгүй");

  await prisma.knowledgeArticle.delete({ where: { id } });
  return json({ ok: true });
});
