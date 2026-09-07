import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { requireAdmin } from "@/server/auth";
import { handler, httpError, json, publicCache, readJson, safeText } from "@/server/http";
import { slugify } from "@/server/tripInput";

/** Article-scoped slug uniqueness — same pattern as posts, its own table. */
export async function uniqueKnowledgeSlug(base: string, excludeId?: string) {
  let candidate = base;
  let counter = 2;

  for (;;) {
    const existing = await prisma.knowledgeArticle.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) return candidate;

    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

function toStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 300))
    .slice(0, max);
}

/** GET /api/knowledge — published articles, newest first. `?all=true` adds drafts (admin). */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);

  if (url.searchParams.get("all") === "true") {
    await requireAdmin(req);
    return json(await prisma.knowledgeArticle.findMany({ orderBy: { createdAt: "desc" } }));
  }

  const articles = await prisma.knowledgeArticle.findMany({
    where: { isPublished: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    // The list card doesn't need the full facts/body payload.
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

  return publicCache(NextResponse.json(articles));
});

/** POST /api/knowledge — create an article (admin). */
export const POST = handler(async (req: Request) => {
  await requireAdmin(req);

  const body = await readJson(req);

  const title = safeText(body.title, 300);
  if (!title) throw httpError(400, "Гарчиг оруулна уу");

  const facts = toStringArray(body.facts, 40);
  const text = safeText(body.body, 50_000);

  // The facts list IS the content here; body is optional framing text around
  // it. Requiring one or the other (not both) matches how this is actually
  // written — sometimes just a photo and a list of numbers is the whole piece.
  if (facts.length === 0 && !text) {
    throw httpError(400, "Ядаж нэг сонирхолтой мэдээлэл эсвэл текст оруулна уу");
  }

  const base = safeText(body.slug, 200) || slugify(title, "knowledge");
  const slug = await uniqueKnowledgeSlug(base);

  const isPublished = body.isPublished === true;

  const article = await prisma.knowledgeArticle.create({
    data: {
      slug,
      title,
      excerpt: safeText(body.excerpt, 500),
      body: text,
      facts,
      coverImage: safeText(body.coverImage, 500),
      video: safeText(body.video, 500),
      isPublished,
      publishedAt: isPublished ? new Date() : null,
    },
  });

  return json(article, { status: 201 });
});
