import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { GoogleOAuthProvider } from "@react-oauth/google";

import ClientI18nProvider from "@/components/i18n/ClientI18nProvider";
import QueryProvider from "./QueryProvider";
import { AuthProvider } from "./provider/AuthProvider";
import Providers from "@/components/Providers";
import AppShellClient from "@/components/AppShellClient";
import SiteFooter from "@/components/layout/SiteFooter";
import { getSiteNav } from "@/server/catalog";
import { LOCALES } from "@/lib/locales";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * Every storefront page carries the menu's live trip and category counts, so
 * every page refreshes at least this often; a trip save refreshes them at once
 * (revalidateTag("site-nav") in the trip routes).
 */
export const revalidate = 300;

const siteNav = unstable_cache(getSiteNav, ["site-nav"], { revalidate: 300, tags: ["site-nav"] });

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!LOCALES.includes(locale as (typeof LOCALES)[number])) {
    return notFound();
  }

  let messages: Record<string, unknown>;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch (err) {
    console.error("LOCALE LAYOUT: messages import failed for", locale, err);
    return notFound();
  }

  const nav = await siteNav();

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""}>
      <QueryProvider>
        <ClientI18nProvider locale={locale} messages={messages}>
          <AuthProvider>
            <Providers>
              <AppShellClient nav={nav} footer={<SiteFooter nav={nav} />}>
                {children}
              </AppShellClient>
            </Providers>
          </AuthProvider>
        </ClientI18nProvider>
      </QueryProvider>
    </GoogleOAuthProvider>
  );
}
