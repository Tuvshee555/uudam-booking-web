import { Plus } from "lucide-react";

import type { FaqItem } from "@/lib/siteContent";

/**
 * Questions as native <details>: keyboard and screen-reader support for free,
 * and every answer stays in the HTML for search engines.
 */
export default function FaqList({ items, idPrefix = "faq" }: { items: FaqItem[]; idPrefix?: string }) {
  return (
    <div className="divide-y divide-border border-y border-border">
      {items.map((item, index) => (
        <details key={`${item.q}-${index}`} id={`${idPrefix}-${index + 1}`} className="group scroll-mt-28">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left text-[16px] font-semibold text-foreground marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-transform duration-300 group-open:rotate-45 group-open:border-primary group-open:bg-primary group-open:text-primary-foreground">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </span>
          </summary>
          <p className="max-w-3xl pb-6 pr-12 text-[15px] leading-relaxed text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
