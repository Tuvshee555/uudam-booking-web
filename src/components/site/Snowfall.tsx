"use client";

/**
 * Falling snow over the storefront in winter, with a «Цас унтраах / Цас асаах» button (the client's
 * request, 2026-11-15, after a news site with the same effect).
 *
 * - One canvas over the page, under the header, the bottom bar, the chat and dialogs; it never takes
 *   a click (pointer-events: none) and is hidden from screen readers.
 * - Most pages are white, so each flake is white with a faint ice-blue edge: seen on photos and white.
 * - Winter only (November–February); outside it nothing renders.
 * - The visitor's choice is remembered on that browser. A visitor who asks the system for less motion
 *   starts with it off.
 * - Stops drawing when switched off or when the tab is hidden; fewer flakes on small screens.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Snowflake } from "lucide-react";

import { cn } from "@/lib/utils";

const STORAGE_KEY = "uudam.snow";
const WINTER_MONTHS = new Set([10, 11, 0, 1]); // Nov, Dec, Jan, Feb (Date.getMonth)

type Flake = { x: number; y: number; r: number; speed: number; sway: number; phase: number; alpha: number; star: boolean; spin: number; angle: number };

export function isSnowSeason(date = new Date()): boolean {
  return WINTER_MONTHS.has(date.getMonth());
}

function readChoice(): "on" | "off" | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "on" || value === "off" ? value : null;
  } catch {
    return null;
  }
}

/** This visit's choice, so the button works even where storage is blocked (private mode). */
let visitChoice: "on" | "off" | null = null;
const listeners = new Set<() => void>();

function saveChoice(value: "on" | "off") {
  visitChoice = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Private mode or blocked storage: the choice simply lasts for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** In the browser: hidden out of season, else the visitor's choice, else on (off when he asks for less motion). */
function snowState(): "hidden" | "on" | "off" {
  if (!isSnowSeason()) return "hidden";
  const choice = visitChoice ?? readChoice();
  if (choice) return choice;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "off" : "on";
}

/** On the server nothing renders: the season, the choice and the motion setting live in the browser. */
const serverSnowState = () => "hidden" as const;

function flakeCount(width: number, height: number): number {
  const byArea = Math.round((width * height) / 15000);
  return Math.max(24, Math.min(width < 640 ? 45 : 110, byArea));
}

function makeFlake(width: number, height: number, anywhere: boolean): Flake {
  const star = Math.random() < 0.28;
  return {
    x: Math.random() * width,
    y: anywhere ? Math.random() * height : -12 - Math.random() * 40,
    r: star ? 3.2 + Math.random() * 2.6 : 1.1 + Math.random() * 2,
    speed: 0.35 + Math.random() * 0.9,
    sway: 0.25 + Math.random() * 0.6,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.55 + Math.random() * 0.4,
    star,
    spin: (Math.random() - 0.5) * 0.01,
    angle: Math.random() * Math.PI,
  };
}

function drawStar(ctx: CanvasRenderingContext2D, flake: Flake) {
  const arm = flake.r * 1.35;
  const twig = arm * 0.38;
  ctx.save();
  ctx.translate(flake.x, flake.y);
  ctx.rotate(flake.angle);
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (i * Math.PI) / 3;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    ctx.moveTo(0, 0);
    ctx.lineTo(cos * arm, sin * arm);
    // The small V near each arm's end, as a snowflake reads at a glance.
    const bx = cos * arm * 0.62;
    const by = sin * arm * 0.62;
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(a + 0.7) * twig, by + Math.sin(a + 0.7) * twig);
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(a - 0.7) * twig, by + Math.sin(a - 0.7) * twig);
  }
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(86, 122, 162, ${flake.alpha * 0.6})`;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.strokeStyle = `rgba(255, 255, 255, ${flake.alpha})`;
  ctx.lineWidth = 1.15;
  ctx.stroke();
  ctx.restore();
}

function drawDot(ctx: CanvasRenderingContext2D, flake: Flake) {
  ctx.beginPath();
  ctx.arc(flake.x, flake.y, flake.r + 0.9, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(86, 122, 162, ${flake.alpha * 0.45})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${flake.alpha})`;
  ctx.fill();
}

function SnowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let width = 0;
    let height = 0;
    let flakes: Flake[] = [];
    let frame = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const wanted = flakeCount(width, height);
      flakes = flakes.length
        ? [...flakes.slice(0, wanted), ...Array.from({ length: Math.max(0, wanted - flakes.length) }, () => makeFlake(width, height, true))]
        : Array.from({ length: wanted }, () => makeFlake(width, height, true));
    };

    const tick = (now: number) => {
      const step = Math.min(now - last, 50) / 16.7;
      last = now;
      ctx.clearRect(0, 0, width, height);
      for (const flake of flakes) {
        flake.y += flake.speed * step;
        flake.phase += 0.012 * step;
        flake.x += Math.sin(flake.phase) * flake.sway * step;
        flake.angle += flake.spin * step;
        if (flake.y > height + 12 || flake.x < -20 || flake.x > width + 20) Object.assign(flake, makeFlake(width, height, false));
        if (flake.star) drawStar(ctx, flake);
        else drawDot(ctx, flake);
      }
      frame = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (document.visibilityState === "visible") {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };

    resize();
    frame = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" data-print="hide" className="pointer-events-none fixed inset-0 z-30" />;
}

export default function Snowfall() {
  const state = useSyncExternalStore(subscribe, snowState, serverSnowState);
  if (state === "hidden") return null;
  const on = state === "on";
  const toggle = () => saveChoice(on ? "off" : "on");

  return (
    <>
      {on && <SnowCanvas />}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        aria-label={on ? "Цас унтраах" : "Цас асаах"}
        title={on ? "Цас унтраах" : "Цас асаах"}
        data-print="hide"
        className={cn(
          "fixed right-3 top-[calc(4rem+0.75rem)] z-40 inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold shadow-lg backdrop-blur-md transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--uudam-gold))] focus-visible:ring-offset-2",
          "lg:right-6 lg:top-[calc(76px+1rem)] lg:px-4",
          on
            ? "border-white/20 bg-[hsl(var(--uudam-night)/0.82)] text-white hover:bg-[hsl(var(--uudam-night)/0.95)]"
            : "border-border bg-background/90 text-foreground hover:bg-background",
        )}
      >
        <Snowflake aria-hidden="true" className={cn("h-4 w-4 shrink-0", on ? "text-sky-200" : "text-[hsl(var(--uudam-navy))]")} />
        <span className="hidden sm:inline">{on ? "Цас унтраах" : "Цас асаах"}</span>
      </button>
    </>
  );
}
