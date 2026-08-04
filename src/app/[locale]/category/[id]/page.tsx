import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/server/prisma";
import CategoryPageClient from "./CategoryPageClient";

type Props = { params: Promise<{ id: string }> };

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
  };
}

export default async function CategoryPage({ params }: Props) {
  const { id } = await params;
  const category = await findCategory(id);

  // Without this, a bad category link rendered "Энэ ангилалд ... алга
  // байна" — the same copy as a real, empty category — instead of a 404.
  if (!category) notFound();

  return <CategoryPageClient id={id} />;
}
