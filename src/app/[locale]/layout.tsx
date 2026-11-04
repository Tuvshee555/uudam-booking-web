import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import ClientI18nProvider from "@/components/i18n/ClientI18nProvider";
import QueryProvider from "./QueryProvider";
import { AuthProvider } from "./provider/AuthProvider";
import Providers from "@/components/Providers";
import AppShellClient from "@/components/AppShellClient";
import ErrorReporter from "@/components/ErrorReporter";
import SiteFooter from "@/components/layout/SiteFooter";
import { getCachedSiteNav } from "@/server/siteNavCache";
import { LOCALES } from "@/lib/locales";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * Storefront pages are rebuilt when what they show changes (server/revalidate.ts)
 * and once a day by the cron, which moves "today" along. This day is the
 * longest any page goes without a rebuild; a page's own export can only
 * shorten it. Every page carries the menu, so a change that moves the menu
 * refreshes them all.
 */
export const revalidate = 86400;

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

  const nav = await getCachedSiteNav();

  return (
    <QueryProvider>
      <ErrorReporter />
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
  );
}
