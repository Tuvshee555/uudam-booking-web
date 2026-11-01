import Link from "next/link";
import { ChevronRight } from "lucide-react";

import JsonLd from "@/components/content/JsonLd";
import { SITE_URL } from "@/lib/siteUrl";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/**
 * The visible trail and its BreadcrumbList, built from the same list so the
 * two can never disagree. The last crumb is the current page (no link).
 */
export default function Breadcrumbs({
  items,
  tone = "light",
  className,
}: {
  items: Crumb[];
  tone?: "light" | "dark";
  className?: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  };

  return (
    <>
      <nav aria-label="Хуудасны зам" className={className}>
        <ol
          className={cn(
            "flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]",
            tone === "dark" ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {items.map((item, index) => {
            const last = index === items.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                {item.href && !last ? (
                  <Link
                    href={item.href}
                    className={cn("rounded-sm transition-colors focus-ring", tone === "dark" ? "hover:text-white" : "hover:text-foreground")}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={cn("truncate", last && (tone === "dark" ? "text-white" : "text-foreground"))}>
                    {item.label}
                  </span>
                )}
                {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd id="breadcrumbs-json-ld" data={jsonLd} />
    </>
  );
}
