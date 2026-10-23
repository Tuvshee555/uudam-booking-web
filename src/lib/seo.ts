import type { Metadata } from "next";

import { canonicalPath } from "@/lib/locales";

const SITE_NAME = "Uudam Travel Agency";

/**
 * Share image (1200×630) for every page with no photo of its own. A page that
 * sets its own `openGraph` replaces the site-wide one wholesale, which is how
 * nearly every page ended up with no preview image when shared on Facebook.
 */
export const DEFAULT_SHARE_IMAGE = { url: "/og-default.jpg", width: 1200, height: 630, alt: SITE_NAME };

type ShareImage = { url: string; width?: number; height?: number; alt?: string };

/**
 * The parts of a page's metadata that decide how it appears when linked or
 * shared: canonical URL, Open Graph card and Twitter card. Spread it into a
 * page's `metadata` next to its own title/description.
 */
export function shareMetadata(
  path: string,
  title: string,
  description: string,
  image: ShareImage = DEFAULT_SHARE_IMAGE,
  type: "website" | "article" = "website",
): Pick<Metadata, "alternates" | "openGraph" | "twitter"> {
  const url = canonicalPath(path);
  return {
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "mn_MN",
      type,
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}
