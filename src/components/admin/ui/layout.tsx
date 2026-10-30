import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Tone } from "../statuses";

/** The title block every admin page opens with: what this page is, and its main action. */
export function PageHeader({
  title,
  description,
  actions,
  back,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** A white card with an optional title row. The one container style used across the admin. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("min-w-0 scroll-mt-24 rounded-xl border border-border bg-card shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

const STAT_ICON_TONE: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-primary/10 text-primary",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300",
};

/** One number with a plain label under it, and a line saying what it means. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  href,
  linkLabel,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: Tone;
  href?: string;
  linkLabel?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex", STAT_ICON_TONE[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[28px] font-bold leading-9 tracking-tight tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {href && linkLabel && (
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
          {linkLabel}
          <ArrowRight className="h-3 w-3" />
        </span>
      )}
    </>
  );
  const className = "block min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm";

  return href ? (
    <Link
      href={href}
      className={cn(
        className,
        "transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** A label/value line for detail panels. */
export function DetailRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-3 py-2 text-sm", className)}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-foreground">{children}</dd>
    </div>
  );
}
