import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/prisma";
import { optionalAdmin, requireAdmin } from "@/server/auth";
import { handler, httpError, json, publicCache, readJson, safeText } from "@/server/http";
import { slugify } from "@/server/tripInput";
import { uniquePostSlug } from "@/server/contentSlugs";

/** The /guide list is ISR-cached on a long timer — this is the instant-refresh signal. */
function revalidateGuidePages(slug?: string) {
  for (const locale of ["mn", "en", "ko"]) {
    revalidatePath(`/${locale}/guide`, "page");
    if (slug) revalidatePath(`/${locale}/guide/${slug}`, "page");
  }
}

type Ctx = { params: Promise<{ id: string }> };

/** Addressable by id (admin) or slug (storefront), same as trips. */
function findPost(idOrSlug: string) {
  return prisma.post.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } });
}

export const GET = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;

  const post = await findPost(id);
  if (!post) throw httpError(404, "Нийтлэл олдсонгүй");

  // A draft is a 404 to everyone but staff, so an unfinished article can't be
  // read by anyone who guesses the link.
  if (!post.isPublished) {
    const admin = await optionalAdmin(req);
    if (!admin) throw httpError(404, "Нийтлэл олдсонгүй");
    return json(post);
  }

  return publicCache(NextResponse.json(post));
});

export const PUT = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin(req);

  const { id } = await ctx.params;
  const body = await readJson(req);

  const existing = await prisma.post.findUnique({
    where: { id },
    select: { id: true, slug: true, isPublished: true, publishedAt: true },
  });
  if (!existing) throw httpError(404, "Нийтлэл олдсонгүй");

  const title = safeText(body.title, 300);
  const text = safeText(body.body, 50_000);

  const requestedSlug = safeText(body.slug, 200);
  const slug =
    requestedSlug && requestedSlug !== existing.slug
      ? await uniquePostSlug(slugify(requestedSlug, "post"), existing.id)
      : undefined;

  const isPublished = typeof body.isPublished === "boolean" ? body.isPublished : undefined;

  const post = await prisma.post.update({
    where: { id },
    data: {
      ...(title ? { title } : {}),
      ...(text ? { body: text } : {}),
      ...(slug ? { slug } : {}),
      excerpt: safeText(body.excerpt, 500),
      coverImage: safeText(body.coverImage, 500),
      ...(isPublished === undefined ? {} : { isPublished }),
      // Stamp publishedAt the first time it goes live and never move it after,
      // so editing a published article doesn't jump it back to the top.
      ...(isPublished && !existing.publishedAt ? { publishedAt: new Date() } : {}),
    },
  });

  revalidateGuidePages(post.slug);

  return json(post);
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin(req);

  const { id } = await ctx.params;

  const existing = await prisma.post.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!existing) throw httpError(404, "Нийтлэл олдсонгүй");

  await prisma.post.delete({ where: { id } });
  revalidateGuidePages(existing.slug);
  return json({ ok: true });
});
