"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

import type { CatalogFacets, CatalogFilters, FacetOption } from "@/lib/catalogFilters";
import { cn } from "@/lib/utils";

function Group({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border py-5 first:pt-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 rounded-sm text-left text-[13px] font-semibold uppercase tracking-[0.14em] text-foreground focus-ring"
        >
          {title}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
      </h3>
      {open && <div className="mt-4">{children}</div>}
    </section>
  );
}

function Option({
  label,
  count,
  checked,
  onChange,
  type = "checkbox",
  name,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
  type?: "checkbox" | "radio";
  name?: string;
}) {
  const disabled = count === 0 && !checked;
  return (
    <label className={cn("group flex cursor-pointer items-center gap-3 rounded-md py-1.5 text-[14px]", disabled && "cursor-default opacity-45")}>
      <input type={type} name={name} checked={checked} onChange={onChange} disabled={disabled} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
          type === "radio" ? "rounded-full" : "rounded-[5px]",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card group-hover:border-foreground/50",
        )}
      >
        {checked && (type === "radio" ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : <Check className="h-3 w-3" strokeWidth={3} />)}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">{label}</span>
      {count !== undefined && <span className="text-[12px] tabular-nums text-muted-foreground">{count}</span>}
    </label>
  );
}

function OptionList({
  options,
  selected,
  onToggle,
  initial = 8,
}: {
  options: FacetOption[];
  selected: string[];
  onToggle: (key: string) => void;
  initial?: number;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? options : options.slice(0, initial);
  return (
    <div>
      {shown.map((option) => (
        <Option key={option.key} label={option.label} count={option.count} checked={selected.includes(option.key)} onChange={() => onToggle(option.key)} />
      ))}
      {options.length > initial && (
        <button type="button" onClick={() => setAll((value) => !value)} className="mt-2 rounded-sm text-[13px] font-semibold text-foreground underline decoration-gold underline-offset-4 focus-ring">
          {all ? "Цөөнийг харуулах" : `Бүгдийг харах (${options.length})`}
        </button>
      )}
    </div>
  );
}

export function toggle(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
}

/**
 * Every filter with how many trips it would show. Options that would empty
 * the page are dimmed and disabled rather than hidden, so the list does not
 * jump around as filters change.
 */
export default function FilterPanel({
  facets,
  filters,
  onChange,
  hideCategories = false,
}: {
  facets: CatalogFacets;
  filters: CatalogFilters;
  onChange: (next: CatalogFilters, facet: string, value: string) => void;
  hideCategories?: boolean;
}) {
  return (
    <div>
      <Group title="Захиалга">
        <Option
          label="Зөвхөн захиалга авч буй"
          count={facets.available}
          checked={filters.available}
          onChange={() => onChange({ ...filters, available: !filters.available }, "available", String(!filters.available))}
        />
        {(facets.sale > 0 || filters.sale) && (
          <Option label="Хямдралтай" count={facets.sale} checked={filters.sale} onChange={() => onChange({ ...filters, sale: !filters.sale }, "sale", String(!filters.sale))} />
        )}
      </Group>

      {facets.destinations.length > 0 && (
        <Group title="Чиглэл">
          <OptionList
            options={facets.destinations}
            selected={filters.destinations}
            onToggle={(key) => onChange({ ...filters, destinations: toggle(filters.destinations, key) }, "destination", key)}
          />
        </Group>
      )}

      {facets.months.length > 0 && (
        <Group title="Хэзээ явах">
          <OptionList
            options={facets.months}
            selected={filters.months}
            initial={6}
            onToggle={(key) => onChange({ ...filters, months: toggle(filters.months, key) }, "month", key)}
          />
        </Group>
      )}

      {!hideCategories && facets.categories.length > 0 && (
        <Group title="Аяллын төрөл">
          <OptionList
            options={facets.categories}
            selected={filters.categories}
            onToggle={(key) => onChange({ ...filters, categories: toggle(filters.categories, key) }, "category", key)}
          />
        </Group>
      )}

      <Group title="Үнэ · нэг том хүн">
        <Option
          type="radio"
          name="price"
          label="Бүх үнэ"
          checked={!filters.price}
          onChange={() => onChange({ ...filters, price: null }, "price", "any")}
        />
        {facets.prices.map((option) => (
          <Option
            key={option.key}
            type="radio"
            name="price"
            label={option.label}
            count={option.count}
            checked={filters.price === option.key}
            onChange={() => onChange({ ...filters, price: option.key }, "price", option.key)}
          />
        ))}
      </Group>

      <Group title="Хугацаа">
        {facets.durations.map((option) => (
          <Option
            key={option.key}
            label={option.label}
            count={option.count}
            checked={filters.durations.includes(option.key)}
            onChange={() => onChange({ ...filters, durations: toggle(filters.durations, option.key) }, "duration", option.key)}
          />
        ))}
      </Group>

      {facets.tags.length > 0 && (
        <Group title="Сэдэв" defaultOpen={filters.tags.length > 0}>
          <OptionList
            options={facets.tags}
            selected={filters.tags}
            onToggle={(key) => onChange({ ...filters, tags: toggle(filters.tags, key) }, "tag", key)}
          />
        </Group>
      )}
    </div>
  );
}
