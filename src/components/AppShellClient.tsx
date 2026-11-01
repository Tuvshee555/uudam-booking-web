"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import SiteHeader from "@/components/layout/SiteHeader";
import MobileActionBar from "@/components/layout/MobileActionBar";
import TopLoader from "@/components/layout/TopLoader";
import PageTracker from "@/components/analytics/PageTracker";
import TripAdvisorChat from "@/components/chat/TripAdvisorChat";
import type { SiteNav } from "@/lib/siteNav";
import { cn } from "@/lib/utils";

export default function AppShellClient({
  children,
  nav,
  footer,
}: {
  children: ReactNode;
  nav: SiteNav;
  /** Rendered on the server by the layout and passed through as a slot. */
  footer: ReactNode;
}) {
  const pathname = usePathname() ?? "";

  // The admin panel brings its own chrome — the storefront header and footer
  // would just be noise on top of it.
  if (/^\/(mn|en|ko)\/admin(\/|$)/.test(pathname)) {
    return <>{children}</>;
  }

  // The home page opens on a full-bleed photo that runs under the header.
  const isHome = /^\/mn\/?$/.test(pathname);
  // A trip page has its own bottom bar with the price and the booking button.
  const isTripPage = /^\/mn\/trips\/[^/]+\/?$/.test(pathname);

  return (
    <div className="site-theme flex min-h-screen flex-col">
      <a href="#main" className="skip-link">Үндсэн агуулга руу шилжих</a>
      <PageTracker />
      <TopLoader />
      <SiteHeader nav={nav} overlay={isHome} />

      <main id="main" tabIndex={-1} className={cn("flex-1 focus:outline-none", !isHome && "pt-16 lg:pt-[76px]")}>
        {children}
      </main>

      {footer}

      {/* Room for the fixed bottom bar, so the end of the footer is reachable. */}
      <div aria-hidden="true" className="h-[calc(4rem+env(safe-area-inset-bottom))] bg-[hsl(var(--uudam-night))] lg:hidden" />
      {!isTripPage && <MobileActionBar />}
      <TripAdvisorChat />
    </div>
  );
}
