"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type DepartureDraft = {
  id?: string;
  startDate: string; // yyyy-mm-dd, <input type="date">
  endDate: string;
  seatsTotal: string;
  seatsLeft: string;
  price: string;
  childPrice: string;
  status: string;
};

const EMPTY_DEPARTURE: DepartureDraft = {
  startDate: "",
  endDate: "",
  seatsTotal: "",
  seatsLeft: "",
  price: "",
  childPrice: "",
  status: "OPEN",
};

export { EMPTY_DEPARTURE };

/**
 * The three seat states staff actually think in, each backed by a real
 * seatsTotal/seatsLeft pair so online-booking capacity enforcement (which
 * reads seatsLeft, not status) keeps working without staff ever typing a
 * number. "Дүүрсэн" doubles as the SOLD_OUT status so it also blocks new
 * online bookings, not just displays as full.
 */
const SEAT_TIERS = [
  { key: "LOTS", label: "Их суудалтай", status: "OPEN", seatsTotal: 40, seatsLeft: 40 },
  { key: "LOW", label: "Цөөн суудал үлдсэн", status: "ALMOST_FULL", seatsTotal: 40, seatsLeft: 3 },
  { key: "FULL", label: "Дүүрсэн", status: "SOLD_OUT", seatsTotal: 40, seatsLeft: 0 },
] as const;

const OTHER_STATUS_OPTIONS = [
  { value: "CANCELLED", label: "Цуцлагдсан" },
  { value: "DEPARTED", label: "Явсан" },
];

function tierForDraft(dep: DepartureDraft): (typeof SEAT_TIERS)[number]["key"] | null {
  const left = Number(dep.seatsLeft);
  if (dep.status === "SOLD_OUT" || (Number.isFinite(left) && dep.seatsLeft !== "" && left <= 0)) return "FULL";
  if (dep.status === "ALMOST_FULL" || (Number.isFinite(left) && dep.seatsLeft !== "" && left <= 5)) return "LOW";
  if (dep.status === "OPEN") return "LOTS";
  return null;
}

export default function DepartureEditor({
  departures,
  onChange,
}: {
  departures: DepartureDraft[];
  onChange: (next: DepartureDraft[]) => void;
}) {
  function update(index: number, patch: Partial<DepartureDraft>) {
    onChange(departures.map((dep, i) => (i === index ? { ...dep, ...patch } : dep)));
  }

  function remove(index: number) {
    onChange(departures.filter((_, i) => i !== index));
  }

  function applyTier(index: number, tier: (typeof SEAT_TIERS)[number]) {
    update(index, {
      status: tier.status,
      seatsTotal: String(tier.seatsTotal),
      seatsLeft: String(tier.seatsLeft),
    });
  }

  return (
    <div className="space-y-3">
      {departures.map((dep, index) => {
        const activeTier = tierForDraft(dep);
        const isCancelledOrDeparted = dep.status === "CANCELLED" || dep.status === "DEPARTED";

        return (
          <div key={index} className="rounded-xl border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Хөдөлгөөн {index + 1}</span>
              <button type="button" onClick={() => remove(index)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Эхлэх огноо *</Label>
                <Input type="date" value={dep.startDate} onChange={(e) => update(index, { startDate: e.target.value })} />
              </div>
              <div>
                <Label>Дуусах огноо</Label>
                <Input type="date" value={dep.endDate} onChange={(e) => update(index, { endDate: e.target.value })} />
              </div>
              <div>
                <Label>Үнэ (заавал биш, өөрчлөх бол)</Label>
                <Input type="number" min={0} value={dep.price} onChange={(e) => update(index, { price: e.target.value })} placeholder="Үндсэн үнээр" />
              </div>
            </div>

            <div className="mt-3">
              <Label>Суудлын байдал</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {SEAT_TIERS.map((tier) => (
                  <button
                    key={tier.key}
                    type="button"
                    onClick={() => applyTier(index, tier)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      activeTier === tier.key
                        ? tier.key === "FULL"
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : tier.key === "LOW"
                            ? "border-amber-500 bg-amber-500/10 text-amber-600"
                            : "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {tier.label}
                  </button>
                ))}
                <select
                  value={isCancelledOrDeparted ? dep.status : ""}
                  onChange={(e) => update(index, { status: e.target.value })}
                  className="rounded-full border border-border bg-transparent px-3 py-1.5 text-xs text-muted-foreground focus:outline-none"
                >
                  <option value="" disabled>
                    Бусад…
                  </option>
                  {OTHER_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <ExactSeatsOverride dep={dep} onChange={(patch) => update(index, patch)} />
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onChange([...departures, { ...EMPTY_DEPARTURE }])}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
      >
        <Plus className="h-4 w-4" />
        Хөдөлгөөн нэмэх
      </button>
    </div>
  );
}

/** Collapsed by default — the 3-tier picker above covers normal use; this is
 * for staff who know the exact headcount and don't want the tier's default
 * (e.g. 40) left in place. */
function ExactSeatsOverride({
  dep,
  onChange,
}: {
  dep: DepartureDraft;
  onChange: (patch: Partial<DepartureDraft>) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
      >
        Яг тоогоор оруулах
      </button>
    );
  }

  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      <div>
        <Label>Нийт суудал</Label>
        <Input type="number" min={0} value={dep.seatsTotal} onChange={(e) => onChange({ seatsTotal: e.target.value })} />
      </div>
      <div>
        <Label>Үлдсэн суудал</Label>
        <Input type="number" min={0} value={dep.seatsLeft} onChange={(e) => onChange({ seatsLeft: e.target.value })} />
      </div>
    </div>
  );
}
