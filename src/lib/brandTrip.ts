import { BRAND, BRAND_DISCOUNT_MNT, renameBrandIn } from "@/lib/brand";
import { brandTrip } from "@/lib/brandPricing";
import { applyDateDeals } from "@/lib/dateDeals";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * The trip the way THIS deployment's brand shows it to the public. First, for every brand, the
 * per-date sales and «Онцлох» dates staff set (lib/dateDeals.ts); then a secondary brand's lower
 * adult/child fares and the primary brand's name and links swapped for its own
 * (lib/brandPricing.ts). A trip with no date deals comes back as the very same object on the
 * primary brand, so uudamtravel.mn is otherwise unaffected.
 *
 * Public read paths only (publicTrip, the catalogue summaries, the advisor's search list, the
 * availability poll, enquiry estimates). Never an admin read, never anything written back.
 */
export function brandPublicTrip<T>(trip: T): T {
  const dealt = applyDateDeals(trip);
  if (BRAND.isPrimary) return dealt;
  // brandTrip lowers sale and regular fares alike; the trip's sale badge and struck "from" price
  // are then worked out again from the lowered figures, so the percent matches what is shown.
  const branded = applyDateDeals(brandTrip(dealt, { discount: BRAND_DISCOUNT_MNT, rename: brandCopy, rewriteUrl: brandUrl }));
  if (BRAND.testimonials || !branded || typeof branded !== "object") return branded;
  // Reviews and ratings were written about the primary brand: never shown as this brand's.
  const out = { ...branded } as Record<string, unknown>;
  if ("testimonials" in out) out.testimonials = [];
  if ("avgRating" in out) out.avgRating = 0;
  if ("reviewCount" in out) out.reviewCount = 0;
  return out as T;
}

/** The primary brand's name in shared copy (articles, settings, trip text), as this brand's. */
export function brandCopy(text: string): string {
  return BRAND.isPrimary ? text : renameBrandIn(text, BRAND, SITE_URL);
}

function chatbotBase(): string {
  return (process.env.NEXT_PUBLIC_CHATBOT_URL ?? "").trim().replace(/\/+$/, "");
}

/**
 * The primary brand's own links, pointed at this brand's: the chatbot's rendered poster PDF (the
 * secondary brand's chatbot renders it with its own name and prices) and pages of the primary site.
 */
export function brandUrl(url: string): string {
  if (BRAND.isPrimary || !url) return url;
  const bot = chatbotBase();
  let out = url;
  if (bot) out = out.replace(/^https?:\/\/uudam-chatbot\.vercel\.app(?=\/api\/poster-pdf)/i, bot);
  return out.replace(/^https?:\/\/(?:www\.)?uudamtravel\.mn(?=\/|$)/i, SITE_URL);
}
