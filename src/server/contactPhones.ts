import { unstable_cache } from "next/cache";

import { DEFAULT_PHONES, phonesFrom, type ContactPhones } from "@/lib/contact";
import { getSiteSettings } from "@/server/siteSettings";

/**
 * The phone numbers saved in admin Settings, or the defaults (lib/contact.ts phonesFrom). Cached
 * under the "site-nav" tag, which a settings save revalidates (server/revalidate.ts), so a new
 * number shows on every page as soon as it is saved. A database hiccup never blanks the numbers.
 */
export const getContactPhones = unstable_cache(
  async (): Promise<ContactPhones> => {
    try {
      return phonesFrom(await getSiteSettings());
    } catch {
      return DEFAULT_PHONES;
    }
  },
  ["contact-phones"],
  { tags: ["site-nav"], revalidate: 86400 },
);
