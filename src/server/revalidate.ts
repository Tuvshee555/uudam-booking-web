import { revalidatePath, revalidateTag } from "next/cache";

import { invalidateCatalog } from "@/server/cache";

/**
 * After any change to what the storefront shows — a trip, its dates or price,
 * a category. Every storefront page carries the menu's counts, so the whole
 * locale layout is refreshed (lazily: each page re-renders on its next visit),
 * the cached menu data is expired at once, and the sitemap is rebuilt so a new
 * or withdrawn trip is listed or dropped straight away.
 */
export function revalidateStorefront() {
  invalidateCatalog();
  revalidateTag("site-nav", { expire: 0 });
  revalidatePath("/[locale]", "layout");
  revalidatePath("/sitemap.xml");
}
