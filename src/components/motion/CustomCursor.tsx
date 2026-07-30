"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function CustomCursor() {
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  const springConfig = { damping: 20, stiffness: 300, mass: 0.5 };
  const ringX = useSpring(mouseX, springConfig);
  const ringY = useSpring(mouseY, springConfig);

  const isPointer = useRef(false);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only show on non-touch devices
    if (typeof window === "undefined") return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch) return;

    const move = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    const checkPointer = (e: MouseEvent) => {
      const target = e.target as Element;
      const hovering = target.closest("a, button, [role=button], input, select, textarea, [data-cursor-pointer]");
      isPointer.current = !!hovering;
      if (dotRef.current) {
        dotRef.current.style.transform = hovering
          ? "translate(-50%, -50%) scale(2.5)"
          : "translate(-50%, -50%) scale(1)";
        dotRef.current.style.opacity = hovering ? "0.4" : "1";
      }
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", checkPointer);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", checkPointer);
    };
  }, [mouseX, mouseY]);

  // Don't render on server or touch devices
  if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
    return null;
  }

  return (
    <>
      {/* Small dot — follows cursor directly */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed z-[9999] w-2 h-2 rounded-full bg-foreground transition-transform duration-150"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Ring — springs behind */}
      <motion.div
        className="pointer-events-none fixed z-[9998] w-8 h-8 rounded-full border border-foreground/40"
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
          position: "fixed",
          left: 0,
          top: 0,
        }}
      />

      {/* Move dot with raw motion value via inline style sync */}
      <SyncDot mouseX={mouseX} mouseY={mouseY} dotRef={dotRef} />
    </>
  );
}

// Syncs the raw dot position without spring lag
function SyncDot({
  mouseX,
  mouseY,
  dotRef,
}: {
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
  dotRef: React.RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    const unsub = mouseX.on("change", (x) => {
      if (dotRef.current) dotRef.current.style.left = `${x}px`;
    });
    const unsub2 = mouseY.on("change", (y) => {
      if (dotRef.current) dotRef.current.style.top = `${y}px`;
    });
    return () => { unsub(); unsub2(); };
  }, [mouseX, mouseY, dotRef]);
  return null;
}
