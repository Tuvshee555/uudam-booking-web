import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { GoogleOAuthProvider } from "@react-oauth/google";

import ClientI18nProvider from "@/components/i18n/ClientI18nProvider";
import QueryProvider from "./QueryProvider";
import { AuthProvider } from "./provider/AuthProvider";
import Providers from "@/components/Providers";
import AppShellClient from "@/components/AppShellClient";

const LOCALES = ["mn", "en", "ko"] as const;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

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
  } catch {
    return notFound();
  }

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""}>
      <QueryProvider>
        <ClientI18nProvider locale={locale} messages={messages}>
          <AuthProvider>
            <Providers>
              <AppShellClient>{children}</AppShellClient>
            </Providers>
          </AuthProvider>
        </ClientI18nProvider>
      </QueryProvider>
    </GoogleOAuthProvider>
  );
}
