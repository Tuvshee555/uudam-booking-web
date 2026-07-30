import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

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
  openGraph: {
    title: "Uudam Travel Agency",
    description: "Гадаад, дотоодын аяллын багц. Хөтөлбөр, үнэ, огноог шууд харна.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <body className={`${manrope.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
