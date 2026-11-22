import type { Metadata, Viewport } from "next";
import { Manrope, Montserrat, Noto_Serif_Display } from "next/font/google";
import { preconnect } from "react-dom";
import "./globals.css";
import JsonLd from "@/components/content/JsonLd";
import { CONTACT, hasLink } from "@/lib/contact";
import { getContactPhones } from "@/server/contactPhones";
import { DEFAULT_SHARE_IMAGE } from "@/lib/seo";
import { SITE_URL } from "@/lib/siteUrl";
import { BRAND } from "@/lib/brand";

/**
 * cyrillic-ext is not optional here: Ө and Ү — which appear in ordinary
 * Mongolian words like "Өдөр" and "Үнэ" — live in that subset. Without it the
 * browser silently swaps in a fallback face mid-word.
 */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

/**
 * The display face for headings, chosen by rendering real Mongolian copy:
 * Playfair has no Ү/Ө (it falls back mid-word), Cormorant and Forum draw л
 * and д in the old Λ-like form, and Prata and Literata set "11" as "ll".
 * Noto Serif Display keeps Ө, Ү and the digits clear at every heading size.
 */
const displaySerif = Noto_Serif_Display({
  variable: "--font-display",
  // One weight: each extra weight is three more font files (latin, cyrillic,
  // cyrillic-ext) racing the hero photo on a slow connection.
  weight: ["500"],
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

/**
 * The secondary brand's face (lib/brand.ts, globals.css [data-brand="magnai"]): Montserrat for
 * text and headings. Not preloaded, so uudamtravel.mn never downloads it; cyrillic-ext for Ө/Ү.
 */
const brandSans = Montserrat({
  variable: "--font-brand",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} — Аяллын захиалга`,
    template: `%s · ${BRAND.shortName}`,
  },
  description:
    `${BRAND.name} — аяллын багц: хөтөлбөр, үнэ, хөдлөх огноог шууд харж захиална.`,
  applicationName: BRAND.shortName,
  icons: {
    icon: BRAND.favicon,
    apple: BRAND.appleIcon,
  },
  // Pages that set their own openGraph (all the public ones) replace this
  // wholesale; it is the fallback for anything that doesn't, so a link to one
  // of those still unfurls with a picture.
  openGraph: {
    title: BRAND.name,
    description: "Аяллын багц: хөтөлбөр, үнэ, огноог шууд харна.",
    type: "website",
    siteName: BRAND.name,
    locale: "mn_MN",
    images: [DEFAULT_SHARE_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [DEFAULT_SHARE_IMAGE.url] },
};

export const viewport: Viewport = {
  themeColor: BRAND.themeColor,
};

/**
 * One TravelAgency entity for the whole site — trip pages layer a TouristTrip
 * on top of this via their own JSON-LD rather than repeating the business
 * fields, so the address/phone only ever need updating in one place.
 */
const businessJsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  "@id": `${SITE_URL}/#agency`,
  name: BRAND.name,
  url: SITE_URL,
  logo: `${SITE_URL}${BRAND.icon512}`,
  image: `${SITE_URL}${BRAND.ogImage}`,
  address: {
    "@type": "PostalAddress",
    streetAddress: CONTACT.address,
    addressLocality: "Улаанбаатар",
    addressCountry: "MN",
  },
  // The telephone is added per render from admin Settings (RootLayout below).
  ...(hasLink(CONTACT.email) ? { email: CONTACT.email } : {}),
  sameAs: [CONTACT.facebook, CONTACT.instagram].filter((url) => hasLink(url)),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The number saved in admin Settings (server/contactPhones.ts), not only the env default.
  const { phone } = await getContactPhones();
  const agencyJsonLd = hasLink(phone) ? { ...businessJsonLd, telephone: phone } : businessJsonLd;
  // Every page leads with a Cloudinary photo: open that connection while the
  // HTML is still arriving, not after the image tag is parsed.
  preconnect("https://res.cloudinary.com");
  return (
    <html lang="mn" suppressHydrationWarning {...(BRAND.isPrimary ? {} : { "data-brand": BRAND.key })}>
      <body className={BRAND.isPrimary ? `${manrope.variable} ${displaySerif.variable} font-sans antialiased` : `${manrope.variable} ${displaySerif.variable} ${brandSans.variable} font-sans antialiased`}>
        <JsonLd id="business-json-ld" data={agencyJsonLd} />
        {children}
      </body>
    </html>
  );
}
