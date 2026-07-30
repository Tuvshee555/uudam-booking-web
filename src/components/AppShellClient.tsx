"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import TopLoader from "@/components/layout/TopLoader";
import PageTracker from "@/components/analytics/PageTracker";
import TripAdvisorChat from "@/components/chat/TripAdvisorChat";

export default function AppShellClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // The admin panel brings its own chrome — the storefront header and footer
  // would just be noise on top of it.
  const isAdmin = /^\/(mn|en|ko)\/admin(\/|$)/.test(pathname ?? "");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <PageTracker />
      <TopLoader />
      <SiteHeader />

      {/* Header is fixed: 64px rail everywhere, plus the 44px category strip
          that only exists from lg up. */}
      <main className="min-h-screen pt-16 lg:pt-[108px]">{children}</main>

      <SiteFooter />
      <TripAdvisorChat />
    </>
  );
}
