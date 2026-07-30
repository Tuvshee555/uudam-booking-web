"use client";

import { Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Нээлттэй" },
  { value: "ALMOST_FULL", label: "Дүүрч байгаа" },
  { value: "SOLD_OUT", label: "Дүүрсэн" },
  { value: "CANCELLED", label: "Цуцлагдсан" },
  { value: "DEPARTED", label: "Явсан" },
];

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

  return (
    <div className="space-y-3">
      {departures.map((dep, index) => (
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
              <Label>Төлөв</Label>
              <select
                value={dep.status}
                onChange={(e) => update(index, { status: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Нийт суудал</Label>
              <Input type="number" min={0} value={dep.seatsTotal} onChange={(e) => update(index, { seatsTotal: e.target.value })} />
            </div>
            <div>
              <Label>Үлдсэн суудал</Label>
              <Input type="number" min={0} value={dep.seatsLeft} onChange={(e) => update(index, { seatsLeft: e.target.value })} />
            </div>
            <div>
              <Label>Үнэ (заавал биш, өөрчлөх бол)</Label>
              <Input type="number" min={0} value={dep.price} onChange={(e) => update(index, { price: e.target.value })} placeholder="Үндсэн үнээр" />
            </div>
          </div>
        </div>
      ))}

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
