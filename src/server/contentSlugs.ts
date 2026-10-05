import { prisma } from "@/server/prisma";

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
