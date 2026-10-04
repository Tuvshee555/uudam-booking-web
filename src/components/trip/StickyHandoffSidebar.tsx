"use client";

import type { ReactNode } from "react";

/**
 * Keep booking visible while the traveller reads the trip. The earlier
 * handoff/fixed-position logic could release the box while there was still
 * useful page content, leaving the right column empty. A normal sticky
 * sidebar is predictable; when it is tall, only the sidebar itself scrolls.
 */
export default function StickyHandoffSidebar({
  topOffset,
  bottomGap = 16,
  children,
}: {
  /** Distance from the viewport top where the box locks, in px (matches the site header + nav height). */
  topOffset: number;
  /** Breathing room kept under the box while locked, in px. */
  bottomGap?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{ top: topOffset, maxHeight: `calc(100vh - ${topOffset + bottomGap}px)` }}
      className="lg:sticky lg:overflow-y-auto lg:overscroll-contain lg:pb-1 lg:pr-1"
    >
      {children}
    </div>
  );
}
