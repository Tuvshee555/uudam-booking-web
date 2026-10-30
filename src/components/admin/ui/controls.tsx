"use client";

import { cloneElement, useEffect, useId, useState, type ReactElement, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@/lib/adminFormat";
import { cn } from "@/lib/utils";

/** The current time, refreshed on an interval — for countdowns like "38 мин үлдсэн". */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Waits until typing pauses before a value is used, so a search doesn't fire per keystroke. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className="h-10 bg-card pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Хайлтыг арилгах"
          title="Хайлтыг арилгах"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export type FilterOption<T extends string> = { value: T; label: string; count?: number };

/** A row of filter pills, each with how many items it holds. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 no-scrollbar sm:flex-wrap sm:overflow-visible", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/60",
            )}
          >
            {option.label}
            {typeof option.count === "number" && (
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums",
                  active ? "bg-white/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {formatNumber(option.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A compact native select — accessible and comfortable on phones. */
export function SelectFilter<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      title={label}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn(
        "h-10 min-w-0 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** "1–25 / нийт 132" with previous/next — hidden when everything fits on one page. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label="Хуудаслалт"
      className={cn("flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm", className)}
    >
      <p className="text-muted-foreground tabular-nums">
        {formatNumber(from)}–{formatNumber(to)} / нийт {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
          Өмнөх
        </Button>
        <span className="px-1 tabular-nums text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Дараах
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}

/** A table header cell that sorts by its column when clicked. */
export function SortHeader({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        align === "right" && "flex-row-reverse",
        active && "text-foreground",
      )}
    >
      {label}
      <Icon className={cn("h-3.5 w-3.5", !active && "opacity-50")} />
    </button>
  );
}

/** An on/off toggle. Always paired with words saying what it turns on. */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-slate-300 dark:bg-slate-600",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

/** A switch with a label and a sentence explaining what changes. */
export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4 py-3", className)}>
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{description}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

type FieldControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
};

/**
 * Label, control, hint and error wired together: clicking the label focuses
 * the field, and a screen reader reads the hint and the error with it.
 */
export function FormField({
  label,
  hint,
  error,
  required,
  className,
  controlId,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  /** For a control wrapped with something beside it (an input plus a button): the label points here and children render as given. */
  controlId?: string;
  children: ReactElement<FieldControlProps>;
}) {
  const generated = useId();
  const id = controlId ?? children.props.id ?? generated;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("min-w-0", className)}>
      <Label htmlFor={id} className="mb-1.5 block leading-snug">
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {controlId
        ? children
        : cloneElement(children, {
            id,
            "aria-describedby": describedBy,
            "aria-invalid": error ? true : undefined,
            "aria-required": required || undefined,
          })}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Styles for a native <select> so it matches the text inputs beside it. */
export const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
