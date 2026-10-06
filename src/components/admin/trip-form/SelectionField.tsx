"use client";

import { useId, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { Input } from "@/components/ui/input";

export default function SelectionField({ label, options, selected, onChange }: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const selectedLabels = options.filter((option) => selected.includes(option.id)).map((option) => option.label);
  const visible = options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return (
    <div className="min-w-0">
      <p id={id} className="mb-2 text-sm font-medium">{label}</p>
      <details className="group rounded-md border border-input bg-background">
        <summary aria-labelledby={id} className="flex cursor-pointer list-none items-start gap-3 px-3 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 break-words text-muted-foreground">
            {selectedLabels.length ? <span className="text-foreground">{selectedLabels.join(", ")}</span> : "Сонгоогүй"}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{selected.length}</span>
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border p-3">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input aria-label={`${label} хайх`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Хайх" className="pl-9" />
          </div>
          <div className="grid max-h-60 gap-1 overflow-y-auto">
            {visible.map((option) => (
              <label key={option.id} className="flex cursor-pointer items-start gap-2.5 rounded px-2 py-2 text-sm hover:bg-secondary">
                <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" checked={selected.includes(option.id)}
                  onChange={(event) => onChange(event.target.checked ? [...selected, option.id] : selected.filter((value) => value !== option.id))} />
                <span className="min-w-0 break-words">{option.label}</span>
              </label>
            ))}
            {!visible.length && <p className="px-2 py-3 text-sm text-muted-foreground">Илэрц олдсонгүй.</p>}
          </div>
        </div>
      </details>
    </div>
  );
}
