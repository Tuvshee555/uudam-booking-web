"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ItineraryDraft = {
  title: string;
  description: string;
  location: string;
  meals: string;
  accommodation: string;
};

const EMPTY_DAY: ItineraryDraft = {
  title: "",
  description: "",
  location: "",
  meals: "",
  accommodation: "",
};

export { EMPTY_DAY };

export default function ItineraryEditor({
  days,
  onChange,
}: {
  days: ItineraryDraft[];
  onChange: (next: ItineraryDraft[]) => void;
}) {
  function update(index: number, patch: Partial<ItineraryDraft>) {
    onChange(days.map((day, i) => (i === index ? { ...day, ...patch } : day)));
  }

  function remove(index: number) {
    onChange(days.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= days.length) return;
    const next = [...days];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {days.map((day, index) => (
        <div key={index} className="rounded-xl border border-border bg-secondary/30 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {index + 1}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === days.length - 1} className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => remove(index)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Гарчиг</Label>
              <Input value={day.title} onChange={(e) => update(index, { title: e.target.value })} />
            </div>
            <div>
              <Label>Байршил</Label>
              <Input value={day.location} onChange={(e) => update(index, { location: e.target.value })} />
            </div>
            <div>
              <Label>Байрлах газар</Label>
              <Input value={day.accommodation} onChange={(e) => update(index, { accommodation: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Тайлбар</Label>
              <Textarea rows={2} value={day.description} onChange={(e) => update(index, { description: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Хоол (таслалаар, ж: Өглөө, Орой)</Label>
              <Input value={day.meals} onChange={(e) => update(index, { meals: e.target.value })} placeholder="Өглөө, Орой" />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...days, { ...EMPTY_DAY }])}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
      >
        <Plus className="h-4 w-4" />
        Өдөр нэмэх
      </button>
    </div>
  );
}
