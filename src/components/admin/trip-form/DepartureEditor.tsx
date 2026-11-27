"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/admin/ui";
import { effectiveSale, salePercentOf } from "@/lib/dateDeals";
import { seatsAfterStatus, seatsOverTotal, statusAfterSeats } from "@/lib/dateSeats";
import { formatMnt } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export type DepartureDraft = {
  id?: string;
  startDate: string; // yyyy-mm-dd, <input type="date">
  endDate: string;
  seatsTotal: string;
  seatsLeft: string;
  price: string;
  childPrice: string;
  infantPrice: string;
  status: string;
  /** This date's sale fares ("" = no sale) and «Онцлох» (lib/dateDeals.ts). */
  salePrice: string;
  saleChildPrice: string;
  isFeatured: boolean;
};

const EMPTY_DEPARTURE: DepartureDraft = {
  startDate: "",
  endDate: "",
  seatsTotal: "",
  seatsLeft: "",
  price: "",
  childPrice: "",
  infantPrice: "",
  status: "OPEN",
  salePrice: "",
  saleChildPrice: "",
  isFeatured: false,
};

export { EMPTY_DEPARTURE };

const WEEKDAYS = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromIso(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateLabel(value: string) {
  const date = dateFromIso(value);
  if (!date) return value;
  return `${date.getFullYear()} · ${date.getMonth() + 1}-р сарын ${date.getDate()}`;
}

export const STATUS_OPTIONS = [
  { value: "OPEN", label: "Захиалга авч байна" },
  { value: "ALMOST_FULL", label: "Цөөн суудал" },
  { value: "SOLD_OUT", label: "Дүүрсэн" },
  { value: "PAUSED", label: "Одоогоор идэвхгүй" },
  { value: "CANCELLED", label: "Цуцлагдсан" },
  { value: "DEPARTED", label: "Явсан" },
];

export function CalendarDatePicker({
  label,
  value,
  placeholder = "Огноо сонгох",
  onChange,
  allowClear = false,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  allowClear?: boolean;
}) {
  const selected = useMemo(() => dateFromIso(value), [value]);
  const today = useMemo(() => new Date(), []);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState((selected || today).getFullYear());
  const [viewMonth, setViewMonth] = useState((selected || today).getMonth());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  function goToMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function pick(day: number) {
    onChange(toIsoDate(new Date(viewYear, viewMonth, day)));
    setOpen(false);
  }

  function toggleOpen() {
    if (!open) {
      const base = selected || today;
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth());
    }
    setOpen((current) => !current);
  }

  return (
    <div ref={rootRef} className="relative">
      <Label>{label}</Label>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={toggleOpen}
        className={cn(
          "mt-1 flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
          value ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="truncate">{value ? formatDateLabel(value) : placeholder}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-lg border border-border bg-background p-3 shadow-xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
              aria-label="Өмнөх сар"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold">
              {viewYear} — {viewMonth + 1} сар
            </div>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
              aria-label="Дараах сар"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className="flex h-7 items-center justify-center text-xs font-medium text-muted-foreground">
                {weekday}
              </span>
            ))}
            {cells.map((day, index) => {
              if (day == null) return <span key={`empty-${index}`} />;
              const iso = toIsoDate(new Date(viewYear, viewMonth, day));
              const isSelected = iso === value;
              const isToday = iso === toIsoDate(today);
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pick(day)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
                    isSelected
                      ? "bg-primary font-semibold text-primary-foreground"
                      : isToday
                        ? "border border-primary/40 font-semibold text-primary"
                        : "text-foreground hover:bg-secondary",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                onChange(toIsoDate(today));
                setOpen(false);
              }}
              className="rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
            >
              Өнөөдөр
            </button>
            <button
              type="button"
              onClick={() => {
                if (allowClear) onChange("");
                setOpen(false);
              }}
              disabled={!allowClear}
              className="rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-45"
            >
              Хоослох
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DepartureEditor({
  departures,
  onChange,
}: {
  departures: DepartureDraft[];
  onChange: (next: DepartureDraft[]) => void;
}) {
  function addDeparture(startDate = "") {
    if (startDate && departures.some((dep) => dep.startDate === startDate)) return;
    onChange([...departures, { ...EMPTY_DEPARTURE, startDate }]);
  }

  function update(index: number, patch: Partial<DepartureDraft>) {
    onChange(departures.map((dep, i) => (i === index ? { ...dep, ...patch } : dep)));
  }

  function remove(index: number) {
    onChange(departures.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="max-w-xs pb-2">
          <CalendarDatePicker
            label="Гарах өдөр нэмэх"
            value=""
            placeholder="Календараас өдөр сонгох"
            onChange={addDeparture}
          />
      </div>

      {departures.map((dep, index) => {
        return (
          <details key={index} open={index === 0 || !dep.startDate} className="group border-b border-border">
            <summary className="flex cursor-pointer list-none items-center gap-3 py-3 text-sm [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              <span className="min-w-0 flex-1 break-words">
                <span className="block font-medium">{dep.startDate || "Шинэ гаралт"}{dep.endDate && ` / ${dep.endDate}`}</span>
                <span className="block text-xs text-muted-foreground">{STATUS_OPTIONS.find((option) => option.value === dep.status)?.label}</span>
              </span>
              {dep.price && <span className="shrink-0 text-xs tabular-nums">{Number(dep.price).toLocaleString("mn-MN")}₮</span>}
            </summary>
            <div className="pb-4">
            <div className="flex justify-end">
              <button type="button" onClick={() => { if (window.confirm(`${dep.startDate || "Энэ"} гаралтыг хасах уу?`)) remove(index); }} aria-label="Гаралт хасах" title="Гаралт хасах" className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CalendarDatePicker
                label="Эхлэх огноо *"
                value={dep.startDate}
                placeholder="Эхлэх өдөр"
                onChange={(startDate) => update(index, { startDate })}
              />
              <CalendarDatePicker
                label="Дуусах огноо"
                value={dep.endDate}
                placeholder="Дуусах өдөр"
                onChange={(endDate) => update(index, { endDate })}
                allowClear
              />
              <div>
                <Label>Том хүний үнэ (өөр бол)</Label>
                <Input type="number" min={0} value={dep.price} onChange={(e) => update(index, { price: e.target.value })} placeholder="Үндсэн үнээр" />
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Хүүхдийн үнэ (өөр бол)</Label>
                <Input type="number" min={0} value={dep.childPrice} onChange={(e) => update(index, { childPrice: e.target.value })} placeholder="Үндсэн үнээр" />
              </div>
              <div>
                <Label>Нярайн үнэ (өөр бол)</Label>
                <Input type="number" min={0} value={dep.infantPrice} onChange={(e) => update(index, { infantPrice: e.target.value })} placeholder="Үндсэн үнээр" />
              </div>
            </div>

            <div className="mt-3">
              <Label>Захиалгын төлөв</Label>
              <div className="mt-1.5 max-w-sm">
                <select
                  aria-label="Захиалгын төлөв"
                  value={dep.status}
                  onChange={(e) => update(index, { status: e.target.value, seatsLeft: seatsAfterStatus(e.target.value, dep.seatsLeft) })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">
                «Цөөн суудал» гэж сонговол зөвхөн энэ ({dep.startDate || "сонгосон"}) өдрийн хажууд харагдана. Бусад өдөрт нөлөөлөхгүй.
              </p>

              <ExactSeatsOverride dep={dep} onChange={(patch) => update(index, patch)} />
              <DateDealControls dep={dep} regularAdult={dep.price} regularChild={dep.childPrice} onChange={(patch) => update(index, patch)} />
            </div>
            </div>
          </details>
        );
      })}

      <button
        type="button"
        onClick={() => addDeparture()}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary"
      >
        <Plus className="h-4 w-4" />
        Гаралт нэмэх
      </button>
    </div>
  );
}

function typedFare(value: string): number | null {
  const amount = value.trim() ? Number(value) : NaN;
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** "3,290,000₮ → 2,990,000₮ (−9%)", or why the typed sale will not show on the site. */
function SaleReadout({ who, regular, sale }: { who: string; regular: number | null; sale: number | null }) {
  if (sale === null) return null;
  if (regular === null) {
    return <p role="status" className="mt-1 text-xs font-medium text-amber-700">{who} энгийн үнэ оруулаагүй тул хямдрал сайтад харагдахгүй.</p>;
  }
  if (!effectiveSale(regular, sale)) {
    return (
      <p role="alert" className="mt-1 text-xs font-medium text-destructive">
        Хямдралтай үнэ ({formatMnt(sale)}) энгийн үнээс ({formatMnt(regular)}) бага байх ёстой — сайтад харагдахгүй.
      </p>
    );
  }
  const percent = salePercentOf(regular, sale);
  return (
    <>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        <s>{formatMnt(regular)}</s> → <b className="text-destructive">{formatMnt(sale)}</b> (−{percent}%)
      </p>
      {percent >= 50 && <p role="status" className="mt-0.5 text-xs font-medium text-amber-700">Хямдрал {percent}% байна — тоогоо шалгана уу.</p>}
    </>
  );
}

/**
 * «Хямдралтай үнэ» and «Онцлох» for ONE date, next to its status. The regular fares stay as
 * they are: the site shows them struck through beside the sale (lib/dateDeals.ts), and
 * emptying the sale brings the regular fare straight back. `regularAdult`/`regularChild`
 * are the date's own fares as typed, falling back to the trip's when the date has none.
 */
export function DateDealControls({
  dep,
  regularAdult,
  regularChild,
  onChange,
}: {
  dep: DepartureDraft;
  regularAdult: string;
  regularChild: string;
  onChange: (patch: Partial<DepartureDraft>) => void;
}) {
  const adult = typedFare(regularAdult);
  const child = typedFare(regularChild);
  const sale = typedFare(dep.salePrice);
  const childSale = typedFare(dep.saleChildPrice);
  const day = dep.startDate || "энэ";
  return (
    <div className="mt-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Хямдрал, онцлох <span className="font-normal text-muted-foreground">· зөвхөн {day} өдөр</span></p>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={dep.isFeatured} onCheckedChange={(isFeatured) => onChange({ isFeatured })} label={`${day} өдрийг онцлох`} />
          Онцлох
        </label>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted-foreground">
          Хямдралтай үнэ (том хүн, ₮)
          <Input className="mt-1" aria-label={`${day} өдрийн хямдралтай үнэ`} type="number" min={0} inputMode="numeric" value={dep.salePrice}
            placeholder="Хямдралгүй" onChange={(e) => onChange({ salePrice: e.target.value })} />
          <SaleReadout who="Том хүний" regular={adult} sale={sale} />
        </label>
        <label className="block text-xs text-muted-foreground">
          Хүүхдийн хямдралтай үнэ (₮, заавал биш)
          <Input className="mt-1" aria-label={`${day} өдрийн хүүхдийн хямдралтай үнэ`} type="number" min={0} inputMode="numeric" value={dep.saleChildPrice}
            placeholder="Хямдралгүй" onChange={(e) => onChange({ saleChildPrice: e.target.value })} />
          <SaleReadout who="Хүүхдийн" regular={child} sale={childSale} />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">Сайтад энгийн үнэ дарагдаж, хямдралтай үнэ, хувь нь хажууд харагдана. Захиалга, үнийн тооцоо хямдралтай үнээр бодогдоно.</p>
        {(dep.salePrice || dep.saleChildPrice) && (
          <button type="button" onClick={() => onChange({ salePrice: "", saleChildPrice: "" })} className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-destructive hover:underline">
            Хямдрал арилгах
          </button>
        )}
      </div>
    </div>
  );
}

/** One date's seat count: how many seats it has and how many are left. Always shown, beside the status. */
export function ExactSeatsOverride({
  dep,
  onChange,
}: {
  dep: DepartureDraft;
  onChange: (patch: Partial<DepartureDraft>) => void;
}) {
  const over = seatsOverTotal(dep.seatsTotal, dep.seatsLeft);
  return (
    <div className="mt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Нийт суудал</Label>
          <Input type="number" min={0} inputMode="numeric" value={dep.seatsTotal} placeholder="жишээ: 40" onChange={(e) => onChange({ seatsTotal: e.target.value })} />
        </div>
        <div>
          <Label>Үлдсэн суудал</Label>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={dep.seatsLeft}
            placeholder="жишээ: 12"
            aria-invalid={over || undefined}
            onChange={(e) => onChange({ seatsLeft: e.target.value, status: statusAfterSeats(dep.status, e.target.value) })}
          />
        </div>
      </div>
      <p className={cn("mt-1.5 max-w-lg text-xs", over ? "font-medium text-destructive" : "text-muted-foreground")}>
        {over
          ? "Үлдсэн суудал нийт суудлаас их байна."
          : "Үлдсэн суудал 0 бол энэ өдөр «Дүүрсэн» болно, суудал тавивал дахин нээгдэнэ. Сайтаас захиалга ирэх бүрд тоо автоматаар хасагдана. Сайт тоог нь харуулахгүй — «Цөөн суудал»-ыг төлвөөс сонгоно."}
      </p>
    </div>
  );
}
