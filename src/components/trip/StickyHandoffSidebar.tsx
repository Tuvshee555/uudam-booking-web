"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * The booking sidebar's scroll behaviour, matching the pattern big booking
 * sites use (Airbnb, Booking.com): the price/calendar box is not pinned the
 * whole time — it only locks once it would otherwise scroll off-screen, and
 * only for as long as its OWN content needs more room than the viewport
 * gives it. Three phases as the page scrolls down:
 *
 *   1. NORMAL   — box scrolls with the page like anything else.
 *   2. LOCKED   — once the box's top would reach `topOffset`, it pins there
 *      (position: fixed) and, if its own content is taller than the space
 *      available, that content gets its own internal scrollbar — so a tall
 *      box never has part of itself stuck off-screen with no way to reach
 *      it. Page scroll position keeps moving during this phase (it has to,
 *      so the user can keep reading the long left column); the box just
 *      stays visually parked at the same spot on screen.
 *   3. RELEASED — once the (longer) column to its left has scrolled past
 *      the point where the box's bottom would now be below the column's
 *      own bottom, the box unpins and resumes normal flow, so the column's
 *      tail end runs past it with nothing left pinned in the way.
 *
 * A same-height spacer in normal flow holds the box's place so nothing
 * jumps when `position: fixed` takes it out of the layout.
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
  const columnRef = useRef<HTMLDivElement>(null); // the lg:grid-cols sibling that holds the long content
  const spacerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // "mobile" = below the lg breakpoint: no sticky/locking behaviour at all,
  // the box is plain static flow like the rest of the stacked page.
  const [phase, setPhase] = useState<"mobile" | "normal" | "locked" | "released">("mobile");
  const [boxWidth, setBoxWidth] = useState<number | null>(null);
  const [boxHeight, setBoxHeight] = useState<number | null>(null);
  const [innerMaxHeight, setInnerMaxHeight] = useState(0);

  useLayoutEffect(() => {
    const spacer = spacerRef.current;
    const box = boxRef.current;
    if (!spacer || !box) return;
    // The grid puts the long column and this sidebar as siblings under one
    // parent; the long column is whichever sibling isn't this one.
    const grid = spacer.closest("[data-trip-layout-grid]");
    const longColumn = grid?.querySelector<HTMLElement>("[data-trip-layout-main]") ?? null;
    columnRef.current = longColumn as HTMLDivElement | null;

    // Below the lg breakpoint the sidebar renders inline, in normal document
    // flow, exactly like any other section — no locking, no fixed box, no
    // internal scrollbar. Only decide phases when the grid is actually
    // side-by-side (matches the `lg:grid-cols-[...]` on the parent).
    const isDesktopLayout = () => window.matchMedia("(min-width: 1024px)").matches;

    function measure() {
      const naturalHeight = box!.scrollHeight;
      const available = Math.max(160, window.innerHeight - topOffset - bottomGap);
      return { naturalHeight, available };
    }

    function update() {
      if (!isDesktopLayout()) {
        setPhase("mobile");
        return;
      }
      const spacerRect = spacer!.getBoundingClientRect();
      const { naturalHeight, available } = measure();
      const pinnedBottom = topOffset + Math.min(naturalHeight, available);

      // Where would the box's top be under plain `position: sticky`? Never
      // above its own natural position, never below (container height −
      // its own height). That tells us which phase applies without ever
      // needing position:fixed math to agree with position:sticky math.
      const longBottom = (columnRef.current ?? document.body).getBoundingClientRect().bottom;

      if (spacerRect.top > topOffset) {
        // Box hasn't reached the pin line yet — plain flow.
        setPhase("normal");
        return;
      }
      if (longBottom <= pinnedBottom + 1) {
        // The long column has nothing left below where the pinned box would
        // end — release so the tail of that column runs past a box that is
        // no longer in the way.
        setPhase("released");
        return;
      }
      setPhase("locked");
      setBoxWidth(spacer!.getBoundingClientRect().width);
      // The spacer must reserve exactly what the fixed box visually occupies
      // on screen right now — capped to the viewport room available, never
      // its full (possibly much taller) natural height — or normal page
      // scroll would leave a gap the size of the UNCLAMPED box.
      setBoxHeight(Math.min(naturalHeight, available));
      setInnerMaxHeight(available);
    }

    update();
    const ro = new ResizeObserver(update);
    ro.observe(spacer);
    if (columnRef.current) ro.observe(columnRef.current);
    ro.observe(box);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [topOffset, bottomGap]);

  const locked = phase === "locked";

  return (
    <div ref={spacerRef} style={locked ? { height: boxHeight ?? undefined } : undefined}>
      <div
        ref={boxRef}
        style={
          locked
            ? { position: "fixed", top: topOffset, width: boxWidth ?? undefined, maxHeight: innerMaxHeight }
            : phase === "normal"
              ? { position: "sticky", top: topOffset }
              : undefined
        }
        className={locked ? "overflow-y-auto overscroll-contain pb-1 pr-1" : "overflow-visible"}
      >
        {children}
      </div>
    </div>
  );
}
