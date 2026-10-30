"use client";

import type { ComponentType, ReactNode } from "react";
import axios from "axios";
import { AlertTriangle, Inbox, LogIn, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/[locale]/provider/AuthProvider";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { cn } from "@/lib/utils";
import type { Tone } from "../statuses";

const BADGE_TONE: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  brand: "bg-primary/10 text-primary ring-primary/20",
  info: "bg-sky-50 text-sky-800 ring-sky-600/20 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/25",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25",
  warning: "bg-amber-50 text-amber-900 ring-amber-600/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25",
  danger: "bg-red-50 text-red-800 ring-red-600/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/25",
};

const DOT_TONE: Record<Tone, string> = {
  neutral: "bg-muted-foreground/60",
  brand: "bg-primary",
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

/** A status pill. The dot keeps statuses tellable apart for colour-blind readers too, alongside the words. */
export function StatusBadge({
  tone = "neutral",
  children,
  dot = true,
  className,
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        BADGE_TONE[tone],
        className,
      )}
    >
      {dot && <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_TONE[tone])} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** A small count bubble for nav items and tabs. */
export function CountBadge({ count, tone = "brand", className }: { count: number; tone?: "brand" | "warning" | "danger" | "neutral"; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
        tone === "warning" && "bg-[hsl(var(--uudam-gold))] text-[hsl(var(--uudam-navy-deep))]",
        tone === "danger" && "bg-red-600 text-white",
        tone === "brand" && "bg-primary text-primary-foreground",
        tone === "neutral" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

const ALERT_TONE: Record<Exclude<Tone, "brand" | "neutral">, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  warning: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100",
  danger: "border-red-200 bg-red-50 text-red-900 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200",
};

/** An inline message box: a heads-up, a problem to fix, or a confirmation. */
export function Notice({
  tone = "info",
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  icon?: ComponentType<{ className?: string }>;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex flex-col gap-3 rounded-xl border p-4 text-sm sm:flex-row sm:items-start", ALERT_TONE[tone], className)}
    >
      {Icon && <Icon className="h-5 w-5 shrink-0 opacity-80" />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn("leading-relaxed", title && "mt-0.5 opacity-90")}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** What to show when a list has nothing in it — and what to do about it. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

function httpStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

/**
 * A failed load, with a way out. An expired or revoked session gets a sign-in
 * button instead of a retry that would only fail again.
 */
export function ErrorState({
  error,
  onRetry,
  title,
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  const { locale } = useI18n();
  const { setAuthToken } = useAuth();
  const status = httpStatus(error);
  const signedOut = status === 401 || status === 403;

  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-foreground">
        {signedOut ? "Нэвтрэх эрх дууссан байна" : (title ?? "Мэдээлэл ачаалж чадсангүй")}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {signedOut
          ? "Аюулгүй байдлын үүднээс дахин нэвтэрнэ үү."
          : "Интернэт холболтоо шалгаад дахин оролдоно уу. Дахин гарвал хэсэг хугацааны дараа оролдоорой."}
      </p>
      <div className="mt-4">
        {signedOut ? (
          <Button
            onClick={() => {
              setAuthToken(null);
              window.location.href = `/${locale}/admin/log-in`;
            }}
          >
            <LogIn />
            Дахин нэвтрэх
          </Button>
        ) : (
          onRetry && (
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw />
              Дахин оролдох
            </Button>
          )
        )}
      </div>
    </div>
  );
}

/** Placeholder rows while a list loads, sized like the real ones so nothing jumps. */
export function LoadingRows({ rows = 5, className, rowClassName }: { rows?: number; className?: string; rowClassName?: string }) {
  return (
    <div role="status" aria-label="Ачаалж байна" className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={cn("h-14 animate-pulse rounded-lg bg-muted", rowClassName)} />
      ))}
    </div>
  );
}
