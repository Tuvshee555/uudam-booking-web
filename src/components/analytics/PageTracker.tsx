"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { closeView, resetVideoPlays, trackView } from "@/lib/analytics";

/**
 * Opens a view on mount and closes it — with time on page — when the visitor
 * leaves or navigates away.
 *
 * Mounted once, site-wide. The server works out which trip a path belongs to,
 * so trip pages don't mount a second tracker and double-count themselves.
 */
export default function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    let viewId: string | null = null;
    let closed = false;
    const startedAt = Date.now();

    resetVideoPlays();

    const params =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;

    // Campaign tag if there is one, so "which Facebook post worked" is answerable.
    const source = params?.get("utm_source") ?? params?.get("src") ?? null;

    trackView({ path: pathname ?? "/", source }).then((id) => {
      viewId = id;

      // The visitor may already have left while that request was in flight.
      if (closed && id) closeView(id, startedAt);
    });

    const finish = () => {
      if (closed) return;
      closed = true;
      if (viewId) closeView(viewId, startedAt);
    };

    // `visibilitychange` is the reliable one on mobile — `beforeunload` and
    // `pagehide` are unreliable or skipped entirely when a phone backgrounds
    // the browser.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") finish();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", finish);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", finish);
      finish();
    };
  }, [pathname]);

  return null;
}
