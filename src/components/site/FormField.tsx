"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export const inputClass =
  "h-12 w-full rounded-lg border border-input bg-card px-4 text-[15px] text-foreground transition-colors placeholder:text-muted-foreground/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive/20";

/**
 * A labelled field with its required/optional mark, a hint, and an error
 * message tied to the input for screen readers (aria-describedby).
 */
export default function FormField({
  id,
  label,
  required = false,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string; "aria-required"?: boolean }) => ReactNode;
  className?: string;
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-[13.5px] font-semibold text-foreground">
        <span>
          {label}
          {required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
        </span>
        {!required && <span className="text-[12px] font-normal text-muted-foreground">заавал биш</span>}
      </label>
      <div className="mt-1.5">{children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy, ...(required ? { "aria-required": true } : {}) })}</div>
      {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className={cn("mt-1.5 text-[12.5px] font-medium text-destructive")}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * One submission at a time. The busy flag drives the button; the ref closes
 * the gap before React re-renders, so a fast double tap cannot send twice.
 */
export function useSubmitGuard() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (task: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}

/**
 * Ref callback for the card that replaces a form once it is sent: brings the
 * card's top into view and moves focus to its heading (which needs
 * tabIndex={-1}), so the confirmation is seen and announced. The sticky
 * booking column keeps the form's scroll position, which would otherwise
 * leave the top of the confirmation hidden.
 */
export function revealConfirmation(card: HTMLElement | null) {
  if (!card) return;
  const column = card.closest<HTMLElement>("[data-scroll-column]");
  if (column && column.scrollHeight > column.clientHeight) column.scrollTo({ top: 0 });
  else if (card.getBoundingClientRect().top < 80) card.scrollIntoView({ block: "start" });
  card.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
}
