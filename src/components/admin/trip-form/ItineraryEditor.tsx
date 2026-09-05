"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  ImageIcon,
  Trash2,
  Video,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import ImageUploadField from "./ImageUploadField";

export type ItineraryDraft = {
  title: string;
  description: string;
  location: string;
  meals: string;
  accommodation: string;
  image: string;
  video: string;
};

const EMPTY_DAY: ItineraryDraft = {
  title: "",
  description: "",
  location: "",
  meals: "",
  accommodation: "",
  image: "",
  video: "",
};

export { EMPTY_DAY };

/**
 * A trip runs 8-11 days in this catalogue, and every day previously rendered
 * all seven of its fields at once — roughly seventy inputs stacked on one
 * screen, with no way to see the shape of the trip. Days are collapsed to a
 * one-line summary by default and opened one at a time instead.
 */
export default function ItineraryEditor({
  days,
  onChange,
}: {
  days: ItineraryDraft[];
  onChange: (next: ItineraryDraft[]) => void;
}) {
  // Index of the open day. A brand-new trip opens its first day, since there
  // is nothing to survey yet and the alternative is an empty-looking editor.
  const [openIndex, setOpenIndex] = useState<number | null>(days.length ? null : 0);

  function update(index: number, patch: Partial<ItineraryDraft>) {
    onChange(days.map((day, i) => (i === index ? { ...day, ...patch } : day)));
  }

  function remove(index: number) {
    onChange(days.filter((_, i) => i !== index));
    setOpenIndex(null);
  }

  /**
   * Consecutive days on these trips repeat heavily — same hotel, same city,
   * same meal pattern — so copying the day above and editing one line is the
   * common case, and retyping all of it was the slow one.
   */
  function duplicate(index: number) {
    const next = [...days];
    next.splice(index + 1, 0, { ...days[index] });
    onChange(next);
    setOpenIndex(index + 1);
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= days.length) return;
    const next = [...days];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    if (openIndex === index) setOpenIndex(target);
    else if (openIndex === target) setOpenIndex(index);
  }

  function addDay() {
    onChange([...days, { ...EMPTY_DAY }]);
    setOpenIndex(days.length);
  }

  return (
    <div className="space-y-2">
      {days.map((day, index) => {
        const isOpen = openIndex === index;
        const summary = [day.location, day.accommodation].filter(Boolean).join(" · ");

        return (
          <div
            key={index}
            className={cn(
              "rounded-xl border bg-card",
              isOpen ? "border-primary/40 shadow-sm" : "border-border",
            )}
          >
            {/* Collapsed header — the whole row toggles, so hitting the day is
                enough; the icon buttons stop propagation to stay usable. */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setOpenIndex(isOpen ? null : index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setOpenIndex(isOpen ? null : index);
                }
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 p-3 text-left"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {index + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {day.title || <span className="text-muted-foreground">Гарчиг оруулаагүй</span>}
                </span>
                {summary && (
                  <span className="block truncate text-xs text-muted-foreground">{summary}</span>
                )}
              </span>

              {day.image && <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              {day.video && <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}

              <span className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    move(index, -1);
                  }}
                  disabled={index === 0}
                  title="Дээш"
                  className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    move(index, 1);
                  }}
                  disabled={index === days.length - 1}
                  title="Доош"
                  className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicate(index);
                  }}
                  title="Хуулах"
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-primary"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`${index + 1} дэх өдрийг устгах уу?`)) remove(index);
                  }}
                  title="Устгах"
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>

            {isOpen && (
              <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Гарчиг</Label>
                  <Input
                    value={day.title}
                    onChange={(e) => update(index, { title: e.target.value })}
                    placeholder="Жишээ нь: Улаанбаатар → Бээжин"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Байршил</Label>
                  <Input
                    value={day.location}
                    onChange={(e) => update(index, { location: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Байрлах газар</Label>
                  <Input
                    value={day.accommodation}
                    onChange={(e) => update(index, { accommodation: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Тайлбар</Label>
                  <Textarea
                    rows={3}
                    value={day.description}
                    onChange={(e) => update(index, { description: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Хоол (таслалаар, ж: Өглөө, Орой)</Label>
                  <Input
                    value={day.meals}
                    onChange={(e) => update(index, { meals: e.target.value })}
                    placeholder="Өглөө, Орой"
                    className="mt-1.5"
                  />
                </div>
                <ImageUploadField
                  label="Өдрийн зураг"
                  value={day.image}
                  onChange={(value) => update(index, { image: value })}
                />
                <ImageUploadField
                  label="Өдрийн бичлэг"
                  value={day.video}
                  onChange={(value) => update(index, { video: value })}
                  resourceType="video"
                />
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addDay}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
      >
        <span className="text-base leading-none">+</span>
        Өдөр нэмэх
        {days.length > 0 && <span className="text-xs opacity-60">({days.length + 1} дэх өдөр)</span>}
      </button>
    </div>
  );
}
