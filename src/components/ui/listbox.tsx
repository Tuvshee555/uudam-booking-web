"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type ListboxOption = { value: string; label: string; hint?: string };

type Placement = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

const GAP = 8;
const MARGIN = 12;

/**
 * A styled replacement for a native <select>. The native one's open list is
 * drawn by the operating system — a plain box with a blue highlight that
 * ignores the site's look — which is what customers saw on the catalogue's
 * sort, the home search and the departures filter.
 *
 * Behaves like a select: arrow keys / Home / End move, Enter or Space picks,
 * Escape and clicking outside close. The list is drawn in a fixed portal so a
 * parent with overflow hidden or a sticky bar can't cut it off, and opens
 * upwards when there is no room below.
 */
export default function Listbox({
  value,
  options,
  onChange,
  ariaLabel,
  align = "left",
  className,
  children,
}: {
  value: string;
  options: readonly ListboxOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  align?: "left" | "right";
  className?: string;
  /** What the closed control shows; receives the selected option and whether the list is open. */
  children: (selected: ListboxOption | undefined, open: boolean) => ReactNode;
}) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const open = placement !== null;
  const selected = options.find((option) => option.value === value);

  const place = (): Placement | null => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const width = Math.min(Math.max(rect.width, 224), window.innerWidth - MARGIN * 2);
    const left = Math.min(
      Math.max(MARGIN, align === "right" ? rect.right - width : rect.left),
      window.innerWidth - width - MARGIN,
    );
    const below = window.innerHeight - rect.bottom - GAP - MARGIN;
    const above = rect.top - GAP - MARGIN;
    const wanted = options.length * 44 + 12;
    return below >= Math.min(wanted, 240) || below >= above
      ? { left, width, top: rect.bottom + GAP, maxHeight: below }
      : { left, width, bottom: window.innerHeight - rect.top + GAP, maxHeight: above };
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const close = () => setPlacement(null);
    const follow = () => setPlacement(place());
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", follow);
      window.removeEventListener("resize", follow);
    };
    // place() reads refs and props at call time; re-binding on every render is unnecessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  const show = () => {
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setPlacement(place());
  };

  const choose = (index: number) => {
    const option = options[index];
    setPlacement(null);
    buttonRef.current?.focus();
    if (option && option.value !== value) onChange(option.value);
  };

  const onListKey = (event: React.KeyboardEvent) => {
    const moves: Record<string, () => number> = {
      ArrowDown: () => Math.min(options.length - 1, active + 1),
      ArrowUp: () => Math.max(0, active - 1),
      Home: () => 0,
      End: () => options.length - 1,
    };
    if (moves[event.key]) {
      event.preventDefault();
      setActive(moves[event.key]());
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setPlacement(null);
      buttonRef.current?.focus();
    } else if (event.key === "Tab") {
      setPlacement(null);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${ariaLabel}: ${selected?.label ?? ""}`}
        onClick={() => (open ? setPlacement(null) : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show();
          }
        }}
        className={className}
      >
        {children(selected, open)}
      </button>

      {placement &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel}
            aria-activedescendant={`${listId}-${active}`}
            onKeyDown={onListKey}
            style={{ left: placement.left, width: placement.width, top: placement.top, bottom: placement.bottom, maxHeight: placement.maxHeight }}
            className="fixed z-[70] overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-xl focus:outline-none"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value || "__all"}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors",
                    index === active && "bg-secondary",
                    isSelected ? "font-semibold text-foreground" : "text-foreground/80",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.hint && <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{option.hint}</span>}
                  <Check className={cn("h-4 w-4 shrink-0 text-primary", !isSelected && "invisible")} aria-hidden="true" />
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
