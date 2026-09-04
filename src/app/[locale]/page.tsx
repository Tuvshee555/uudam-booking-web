import { getCategoryTree, getPublishedTrips } from "@/server/catalog";
import HomeClient from "./HomeClient";

/**
 * The homepage previously rendered zero trip cards and no categories in its
 * initial HTML — every list came from a client fetch. It is the page most
 * likely to be crawled, linked and screenshotted, so it is now seeded on the
 * server like the catalogue and trip pages.
 */
export const revalidate = 60;

export default async function HomePage() {
  const [trips, categories] = await Promise.all([getPublishedTrips(), getCategoryTree()]);

  return <HomeClient initialTrips={trips} initialCategories={categories} />;
}
