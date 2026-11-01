import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The heading every storefront section opens with: a gold eyebrow, a serif
 * title, an optional lede, and an optional link aligned to the right.
 */
export default function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  id,
  tone = "light",
  align = "start",
  as: Heading = "h2",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  id?: string;
  tone?: "light" | "dark";
  align?: "start" | "center";
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        centered ? "items-center text-center" : "md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className={cn("max-w-2xl", centered && "mx-auto")}>
        {eyebrow && <p className={cn("eyebrow", tone === "dark" && "eyebrow-on-dark")}>{eyebrow}</p>}
        <Heading id={id} className={cn("display-2 mt-4 text-balance", tone === "dark" ? "text-white" : "text-foreground")}>
          {title}
        </Heading>
        {description && (
          <p className={cn("mt-4 text-pretty", tone === "dark" ? "text-base leading-relaxed text-white/70" : "lede")}>{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** "Бүгдийг үзэх →" — a text link whose underline draws in on hover. */
export function ArrowLink({
  href,
  children,
  tone = "light",
  className,
  onClick,
}: {
  href: string;
  children: ReactNode;
  tone?: "light" | "dark";
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2 rounded-sm text-sm font-semibold focus-ring",
        tone === "dark" ? "text-white" : "text-foreground",
        className,
      )}
    >
      <span className="link-draw pb-0.5">{children}</span>
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}
