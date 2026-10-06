"use client";

import { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { pricingDateRows, pricingDates, patchPricingDate, renamePricingDate, passengerPricingRows, type PricingGroup } from "@/lib/adminDatePricing";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarDatePicker, ExactSeatsOverride, STATUS_OPTIONS, EMPTY_DEPARTURE, type DepartureDraft } from "./DepartureEditor";
import { cn } from "@/lib/utils";

type Props = {
  metadata: Record<string, unknown>;
  departures: DepartureDraft[];
  defaultPrice: string;
  defaultRows: PricingGroup[];
  onChange: (metadata: Record<string, unknown>, departures: DepartureDraft[]) => void;
};

const record = (value: unknown): PricingGroup => value && typeof value === "object" && !Array.isArray(value) ? value as PricingGroup : {};
const amount = (value: unknown) => typeof value === "number" ? String(value) : "";
const fare = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
const infant = (row: PricingGroup) => /нярай|infant|сар|month|\b0\s*[-–]\s*2\b/i.test(`${row.label} ${row.age_range}`);

export default function DatePricingEditor({ metadata, departures, defaultPrice, defaultRows, onChange }: Props) {
  const [selection, setSelection] = useState("");
  const [search, setSearch] = useState("");
  const stored = Array.isArray(metadata.price_groups) ? metadata.price_groups.map(record) : [];
  const groups = [...stored];
  for (const dep of departures) {
    if (!groups.some((group) => pricingDates(group).includes(dep.startDate))) {
      const ages = record(metadata.age_rules);
      const bands = [
        ...(dep.childPrice !== "" ? [{ label: "Хүүхэд", age_range: ages.child || "", price: fare(dep.childPrice), currency: "MNT" }] : []),
        ...(dep.infantPrice !== "" ? [{ label: "Нярай", age_range: ages.infant || "", price: fare(dep.infantPrice), currency: "MNT" }] : []),
      ];
      groups.push({ dates: [dep.startDate], adult_price: fare(dep.price) ?? fare(defaultPrice), passenger_prices: bands.length ? bands : stored.length ? [] : defaultRows });
    }
  }
  if (!groups.length) groups.push({ dates: [], adult_price: fare(defaultPrice), passenger_prices: defaultRows });
  const rows = pricingDateRows(groups);
  const key = (row: typeof rows[number]) => `${row.date}|${row.groupIndex}`;
  const visible = rows.filter((row) => [row.date, groups[row.groupIndex].hotel, groups[row.groupIndex].package_id, groups[row.groupIndex].note].join(" ").toLowerCase().includes(search.toLowerCase()));
  const selected = rows.find((row) => key(row) === selection) || rows[0];
  const group = groups[selected.groupIndex];
  const passengers = passengerPricingRows(group);
  const depIndex = departures.findIndex((dep) => dep.startDate === selected.date);
  const departure = departures[depIndex];
  const currency = String(group.currency || "MNT");

  function update(patch: PricingGroup) {
    const nextGroups = patchPricingDate(groups, selected, patch);
    const nextIndex = selected.groupIndex + (pricingDates(group).length > 1 && selected.date ? 1 : 0);
    setSelection(`${selected.date}|${nextIndex}`);
    let nextDepartures = departures;
    if (departure && ("adult_price" in patch || "passenger_prices" in patch)) {
      const bands = (patch.passenger_prices as PricingGroup[] | undefined) || passengers;
      const child = bands.find((row) => !infant(row));
      const baby = bands.find(infant);
      nextDepartures = departures.map((dep, index) => index === depIndex ? {
        ...dep,
        ...(Object.hasOwn(patch, "adult_price") ? { price: amount(patch.adult_price) } : {}),
        ...(Object.hasOwn(patch, "passenger_prices") ? { childPrice: amount(child?.price), infantPrice: amount(baby?.price) } : {}),
      } : dep);
    }
    onChange({ ...metadata, price_groups: nextGroups }, nextDepartures);
  }

  function updatePassengers(next: PricingGroup[]) {
    const child = next.find((row) => !infant(row));
    const baby = next.find(infant);
    update({ passenger_prices: next, child_price: child?.price ?? null, child_age: child?.age_range || "", infant_price: baby?.price ?? null, infant_age: baby?.age_range || "" });
  }

  function updateDeparture(patch: Partial<DepartureDraft>) {
    onChange(metadata, departures.map((dep, index) => index === depIndex ? { ...dep, ...patch } : dep));
  }

  function add(date: string) {
    if (!date || departures.some((dep) => dep.startDate === date) || rows.some((row) => row.date === date)) return;
    const copy: PricingGroup = { ...group, dates: [date], date_keys: [date], display_dates: [date], passenger_prices: passengers.map((row) => ({ ...row })) };
    delete copy.id;
    const next = [...groups, copy];
    setSelection(`${date}|${next.length - 1}`);
    setSearch("");
    onChange({ ...metadata, price_groups: next }, [...departures, { ...EMPTY_DEPARTURE, startDate: date, price: amount(group.adult_price), childPrice: amount(passengers.find((row) => !infant(row))?.price), infantPrice: amount(passengers.find(infant)?.price) }]);
  }

  return <div className="grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
    <div className="min-w-0">
      <label className="block text-sm lg:hidden">Гарах огноо<select aria-label="Гарах огноо сонгох" value={key(selected)} onChange={(e) => setSelection(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
        {rows.map((row) => <option key={key(row)} value={key(row)}>{row.date || "Үндсэн үнэ"} · {String(groups[row.groupIndex].package_id || groups[row.groupIndex].hotel || groups[row.groupIndex].note || "")} · {typeof groups[row.groupIndex].adult_price === "number" ? Number(groups[row.groupIndex].adult_price).toLocaleString("mn-MN") : "—"}</option>)}
      </select></label>
      <div className="relative mb-2 hidden lg:block"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Огноо хайх" placeholder="Огноо хайх" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
      <div className="hidden max-h-[420px] overflow-y-auto border-y border-border lg:block" role="list" aria-label="Гарах огноонууд">
        {visible.map((row) => {
          const value = groups[row.groupIndex];
          return <button key={key(row)} type="button" aria-pressed={key(selected) === key(row)} onClick={() => setSelection(key(row))} className={cn("flex w-full items-center justify-between gap-3 border-b border-border px-3 py-3 text-left text-sm last:border-0", key(selected) === key(row) ? "border-l-2 border-l-primary bg-secondary" : "hover:bg-secondary/50")}>
            <span className="min-w-0"><span className="block font-medium">{row.date || "Үндсэн үнэ"}</span><span className="block truncate text-xs text-muted-foreground">{String(value.package_id || value.hotel || value.note || "")}</span></span>
            <span className="shrink-0 text-xs tabular-nums">{typeof value.adult_price === "number" ? value.adult_price.toLocaleString("mn-MN") : "—"}</span>
          </button>;
        })}
        {!visible.length && <p className="p-3 text-sm text-muted-foreground">Огноо олдсонгүй.</p>}
      </div>
      <div className="mt-3"><CalendarDatePicker label="Гаралт нэмэх" value="" onChange={add} /></div>
    </div>
    <div className="min-w-0" aria-label="Сонгосон гаралтын үнэ">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
        <div><h3 className="text-base font-semibold">{selected.date || "Үндсэн үнэ"}</h3><p className="text-xs text-muted-foreground">{String(group.package_id || group.note || "")}{group.hotel ? ` · ${group.hotel}` : ""}</p></div>
        {selected.date && <Button type="button" variant="ghost" size="icon" title="Гаралт хасах" aria-label="Сонгосон гаралт хасах" onClick={() => {
          if (!window.confirm(`${selected.date} гаралтыг хасах уу?`)) return;
          const next = groups.flatMap((value) => {
            const dates = pricingDates(value);
            if (!dates.includes(selected.date)) return [value];
            const remaining = dates.filter((date) => date !== selected.date);
            return remaining.length ? [{ ...value, dates: remaining, date_keys: remaining, display_dates: remaining }] : [];
          });
          setSelection("");
          onChange({ ...metadata, price_groups: next }, departures.filter((dep) => dep.startDate !== selected.date));
        }}><Trash2 className="h-4 w-4" /></Button>}
      </div>
      <div className="flex items-center justify-between gap-4 border-b border-border py-3">
        <span className="text-sm font-medium">Том хүн <span className="ml-1 text-xs font-normal text-muted-foreground">{String(record(metadata.age_rules).adult || "")}</span></span>
        <label className="flex w-44 max-w-[55%] items-center gap-2"><Input aria-label="Сонгосон огнооны том хүний үнэ" type="number" min={0} value={amount(group.adult_price)} placeholder={defaultPrice} onChange={(e) => update({ adult_price: fare(e.target.value), adult_price_range: null })} /><span className="text-xs text-muted-foreground">{currency === "MNT" ? "₮" : currency}</span></label>
      </div>
      {passengers.map((passenger, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] items-start gap-2 border-b border-border py-3">
        <div className="space-y-1"><Input aria-label="Зорчигчийн ангилал" value={String(passenger.label || "")} onChange={(e) => updatePassengers(passengers.map((row, i) => i === index ? { ...row, label: e.target.value } : row))} /><Input aria-label="Насны хүрээ" value={String(passenger.age_range || "")} placeholder="Нас" onChange={(e) => updatePassengers(passengers.map((row, i) => i === index ? { ...row, age_range: e.target.value } : row))} className="h-8 text-xs" /></div>
        <div><Input aria-label={`${passenger.label || "Зорчигч"} үнэ`} type="number" min={0} value={amount(passenger.price)} onChange={(e) => updatePassengers(passengers.map((row, i) => i === index ? { ...row, price: fare(e.target.value), note: row.price === 0 && /үнэгүй|free/i.test(String(row.note)) ? "" : row.note } : row))} />
          <label className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={passenger.price === 0 && /үнэгүй|free/i.test(String(passenger.note))} onChange={(e) => updatePassengers(passengers.map((row, i) => i === index ? { ...row, price: e.target.checked ? 0 : null, note: e.target.checked ? "Үнэгүй" : "" } : row))} />Үнэгүй</label>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Насны ангилал хасах" title="Насны ангилал хасах" onClick={() => updatePassengers(passengers.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>)}
      <div className="flex gap-3 py-3">{["Хүүхэд", "Нярай"].map((label) => <Button key={label} type="button" variant="ghost" size="sm" onClick={() => updatePassengers([...passengers, { label, age_range: "", price: null, currency }])}><Plus className="h-3.5 w-3.5" />{label}</Button>)}</div>
      {departure && <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <CalendarDatePicker label="Гарах огноо" value={selected.date} onChange={(date) => {
          if (date === selected.date || departures.some((dep) => dep.startDate === date)) return;
          const next = renamePricingDate(groups, selected.date, date);
          const nextIndex = selected.groupIndex + groups.slice(0, selected.groupIndex + 1).filter((item) => pricingDates(item).includes(selected.date) && pricingDates(item).length > 1).length;
          setSelection(`${date}|${nextIndex}`);
          onChange({ ...metadata, price_groups: next }, departures.map((dep, index) => index === depIndex ? { ...dep, startDate: date } : dep));
        }} />
        <CalendarDatePicker label="Буцах огноо" value={departure.endDate} onChange={(endDate) => updateDeparture({ endDate })} allowClear />
        <label className="text-sm">Захиалгын төлөв<select aria-label="Захиалгын төлөв" value={departure.status} onChange={(e) => updateDeparture({ status: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <div className="sm:col-span-2"><ExactSeatsOverride dep={departure} onChange={updateDeparture} /></div>
      </div>}
      <details className="mt-4 border-t border-border pt-3"><summary className="cursor-pointer text-sm text-muted-foreground">Багц, буудал, нэмэлт мэдээлэл</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{[["label", "Үнийн нэр"], ["package_id", "Аяллын төрөл"], ["hotel", "Буудал"], ["note", "Тэмдэглэл"]].map(([field, label]) => <label key={field} className="text-xs text-muted-foreground">{label}<Input aria-label={label} value={String(group[field] || "")} onChange={(e) => update({ [field]: e.target.value })} /></label>)}</div>
      </details>
    </div>
  </div>;
}
