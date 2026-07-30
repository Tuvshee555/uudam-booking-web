/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { createContext, useContext, useMemo } from "react";

type Messages = Record<string, any>;

type I18nContextType = {
  locale: string;
  messages: Messages;
  t: (key: string, fallback?: string) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export default function ClientI18nProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: Messages;
  children: React.ReactNode;
}) {
  const t = (key: string, fallback?: string) => {
    const value = key
      .split(".")
      .reduce<any>(
        (acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined),
        messages
      );

    return value ?? fallback ?? key;
  };

  const value = useMemo(() => ({ locale, messages, t }), [locale, messages]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside ClientI18nProvider");
  return ctx;
}

export function useLocale() {
  return useI18n().locale;
}

export function useTranslations() {
  const { t } = useI18n();
  return (key: string, fallback?: string) => t(key, fallback);
}
