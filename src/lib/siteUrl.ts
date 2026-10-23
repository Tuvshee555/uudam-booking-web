const PRODUCTION_URL = "https://uudamtravel.mn";

const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i;

/**
 * The public address of the site, used for canonical links, the sitemap,
 * robots.txt, share cards and links inside emails/payment callbacks.
 *
 * The deployed project carried NEXT_PUBLIC_SITE_URL=http://localhost:3000 (a
 * copy of the local .env), so production published a sitemap, robots.txt and
 * canonical tags that all pointed at localhost. A localhost address is only
 * honoured outside production builds.
 */
export function resolveSiteUrl(configured: string | undefined, isProduction: boolean): string {
  const value = (configured ?? "").trim().replace(/\/+$/, "");
  if (!value) return PRODUCTION_URL;
  if (isProduction && LOCAL_HOST.test(value)) return PRODUCTION_URL;
  return value;
}

export const SITE_URL = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV === "production");
