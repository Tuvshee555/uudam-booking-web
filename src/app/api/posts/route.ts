import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, httpError, json, publicCache, readJson, safeText } from "@/server/http";
import { slugify } from "@/server/tripInput";

/**
 * Post-scoped slug uniqueness. `uniqueSlug` in tripInput queries the trip
 * table directly, so it cannot be reused here.
 */
export async function uniquePostSlug(base: string, excludeId?: string) {
  let candidate = base;
  let counter = 2;

  for (;;) {
    const existing = await prisma.post.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) return candidate;

    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

/** GET /api/posts — published guides, newest first. `?all=true` adds drafts (admin). */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);

  if (url.searchParams.get("all") === "true") {
    await requireAdmin(req);
    return json(await prisma.post.findMany({ orderBy: { createdAt: "desc" } }));
  }

  const posts = await prisma.post.findMany({
    where: { isPublished: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    // The body can be long and the list never renders it.
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      coverImage: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  return publicCache(NextResponse.json(posts));
});

/** POST /api/posts — create a guide (admin). */
export const POST = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);

  const title = safeText(body.title, 300);
  if (!title) throw httpError(400, "Гарчиг оруулна уу");

  const text = safeText(body.body, 50_000);
  if (!text) throw httpError(400, "Нийтлэлийн агуулга хоосон байна");

  const base = safeText(body.slug, 200) || slugify(title, "post");
  const slug = await uniquePostSlug(base);

  const isPublished = body.isPublished === true;

  const post = await prisma.post.create({
    data: {
      slug,
      title,
      excerpt: safeText(body.excerpt, 500),
      body: text,
      coverImage: safeText(body.coverImage, 500),
      isPublished,
      // Stamped on first publish so the public ordering is stable even if the
      // article is edited later.
      publishedAt: isPublished ? new Date() : null,
    },
  });

  return json(post, { status: 201 });
});
