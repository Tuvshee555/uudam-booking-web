import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/server/prisma";
import { getCategoryWithTrips } from "@/server/catalog";
import { localeAlternates } from "@/lib/hreflang";
import CategoryPageClient from "./CategoryPageClient";

type Props = { params: Promise<{ id: string }> };

/**
 * Without this the page is prerendered once at build time and its trip list
 * is frozen until the next deploy.
 */
export const revalidate = 60;

async function findCategory(idOrSlug: string) {
  return prisma.category.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: {
      categoryName: true,
      description: true,
      image: true,
      _count: { select: { trips: true } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const category = await findCategory(id);

  if (!category) {
    return { title: "Ангилал олдсонгүй" };
  }

  const description =
    category.description?.trim() ||
    `${category.categoryName} чиглэлийн ${category._count.trips} аялал.`;

  return {
    title: category.categoryName,
    description,
    openGraph: {
      title: category.categoryName,
      description,
      type: "website",
      images: category.image ? [{ url: category.image, width: 1200, height: 630 }] : undefined,
    },
    alternates: { languages: localeAlternates(`/category/${id}`) },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { id } = await params;
  const category = await findCategory(id);

  // Without this, a bad category link rendered "Энэ ангилалд ... алга
  // байна" — the same copy as a real, empty category — instead of a 404.
  if (!category) notFound();

  // Same lookup the client hook would otherwise make on first paint, seeded
  // here so the trip grid exists in the initial HTML. Previously this page
  // fetched category data only for generateMetadata and handed the client
  // component nothing but the id, so the page shipped zero trip cards.
  const initialData = await getCategoryWithTrips(id);

  return <CategoryPageClient id={id} initialData={initialData ?? undefined} />;
}
