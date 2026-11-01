import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Serif_Display } from "next/font/google";
import "./globals.css";
import JsonLd from "@/components/content/JsonLd";
import { CONTACT, hasLink } from "@/lib/contact";
import { DEFAULT_SHARE_IMAGE } from "@/lib/seo";
import { SITE_URL } from "@/lib/siteUrl";

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
  weight: ["400", "500"],
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Uudam Travel Agency — Аяллын захиалга",
    template: "%s · Uudam Travel",
  },
  description:
    "Uudam Travel Agency — аяллын багц: хөтөлбөр, үнэ, хөдлөх огноог шууд харж захиална.",
  applicationName: "Uudam Travel",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  // Pages that set their own openGraph (all the public ones) replace this
  // wholesale; it is the fallback for anything that doesn't, so a link to one
  // of those still unfurls with a picture.
  openGraph: {
    title: "Uudam Travel Agency",
    description: "Аяллын багц: хөтөлбөр, үнэ, огноог шууд харна.",
    type: "website",
    siteName: "Uudam Travel Agency",
    locale: "mn_MN",
    images: [DEFAULT_SHARE_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [DEFAULT_SHARE_IMAGE.url] },
};

export const viewport: Viewport = {
  themeColor: "#0a2540",
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
  name: "Uudam Travel Agency",
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  image: `${SITE_URL}/og-default.jpg`,
  address: {
    "@type": "PostalAddress",
    streetAddress: CONTACT.address,
    addressLocality: "Улаанбаатар",
    addressCountry: "MN",
  },
  ...(hasLink(CONTACT.phone) ? { telephone: CONTACT.phone } : {}),
  ...(hasLink(CONTACT.email) ? { email: CONTACT.email } : {}),
  sameAs: [CONTACT.facebook, CONTACT.instagram].filter((url) => hasLink(url)),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <body className={`${manrope.variable} ${displaySerif.variable} font-sans antialiased`}>
        <JsonLd id="business-json-ld" data={businessJsonLd} />
        {children}
      </body>
    </html>
  );
}
