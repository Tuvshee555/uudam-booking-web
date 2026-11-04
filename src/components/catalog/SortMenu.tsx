"use client";

import { ArrowDownUp, ChevronDown } from "lucide-react";

import Listbox from "@/components/ui/listbox";
import { cn } from "@/lib/utils";

/** The catalogue's sort control: a pill that opens the site-styled list. */
export default function SortMenu<K extends string>({
  value,
  options,
  onChange,
}: {
  value: K;
  options: readonly { key: K; label: string }[];
  onChange: (key: K) => void;
}) {
  return (
    <Listbox
      value={value}
      options={options.map((option) => ({ value: option.key, label: option.label }))}
      onChange={(key) => onChange(key as K)}
      ariaLabel="Эрэмбэлэх"
      align="right"
      className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card pl-3.5 pr-3 text-[13px] font-semibold text-foreground transition-colors hover:border-foreground/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 aria-expanded:border-foreground/40"
    >
      {(selected, open) => (
        <>
          <ArrowDownUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="max-w-[7.5rem] truncate sm:max-w-none">{selected?.label}</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
        </>
      )}
    </Listbox>
  );
}
