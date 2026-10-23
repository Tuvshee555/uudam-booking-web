import type { Metadata } from "next";
import { Manrope } from "next/font/google";
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Uudam Travel Agency — Аяллын захиалга",
    template: "%s · Uudam Travel",
  },
  description:
    "Uudam Travel Agency — гадаад, дотоодын аяллын багц. Хөтөлбөр, үнэ, хөдлөх огноог шууд харж захиална.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  // Pages that set their own openGraph (all the public ones) replace this
  // wholesale; it is the fallback for anything that doesn't, so a link to one
  // of those still unfurls with a picture.
  openGraph: {
    title: "Uudam Travel Agency",
    description: "Гадаад, дотоодын аяллын багц. Хөтөлбөр, үнэ, огноог шууд харна.",
    type: "website",
    siteName: "Uudam Travel Agency",
    locale: "mn_MN",
    images: [DEFAULT_SHARE_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [DEFAULT_SHARE_IMAGE.url] },
};

/**
 * One TravelAgency entity for the whole site — trip pages layer a TouristTrip
 * on top of this via their own JSON-LD rather than repeating the business
 * fields, so the address/phone only ever need updating in one place.
 */
const businessJsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: "Uudam Travel Agency",
  url: SITE_URL,
  image: `${SITE_URL}/uudam-logo.jpg`,
  address: { "@type": "PostalAddress", addressCountry: "MN", streetAddress: CONTACT.address },
  ...(hasLink(CONTACT.phone) ? { telephone: CONTACT.phone } : {}),
  ...(hasLink(CONTACT.email) ? { email: CONTACT.email } : {}),
  sameAs: [CONTACT.facebook, CONTACT.instagram].filter((url) => hasLink(url)),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <body className={`${manrope.variable} font-sans antialiased`}>
        <JsonLd id="business-json-ld" data={businessJsonLd} />
        {children}
      </body>
    </html>
  );
}
