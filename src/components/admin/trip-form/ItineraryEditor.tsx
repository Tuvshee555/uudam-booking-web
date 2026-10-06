"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  ImageIcon,
  Plus,
  Trash2,
  Video,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import ImageUploadField from "./ImageUploadField";

export type ItineraryDraft = {
  id?: string;
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
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const reduceMotion = useReducedMotion();

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
    next.splice(index + 1, 0, { ...days[index], id: undefined });
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
              "rounded-lg border bg-card",
              isOpen ? "border-primary/40 shadow-sm" : "border-border",
            )}
          >
            <div className="flex flex-wrap items-center gap-1 p-2">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`itinerary-editor-day-${index}`}
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded p-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {index + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium">
                  {day.title || <span className="text-muted-foreground">Гарчиг оруулаагүй</span>}
                </span>
                {summary && (
                  <span className="block truncate text-xs text-muted-foreground">{summary}</span>
                )}
              </span>

              {day.image && <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              {day.video && <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>
              <span className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    move(index, -1);
                  }}
                  disabled={index === 0}
                  title="Дээш"
                  aria-label="Өдөр дээш шилжүүлэх"
                  className="rounded p-2 text-muted-foreground hover:bg-secondary disabled:opacity-30"
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
                  aria-label="Өдөр доош шилжүүлэх"
                  className="rounded p-2 text-muted-foreground hover:bg-secondary disabled:opacity-30"
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
                  aria-label="Өдөр хуулах"
                  className="rounded p-2 text-muted-foreground hover:bg-secondary hover:text-primary"
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
                  aria-label="Өдөр устгах"
                  className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>

            <AnimatePresence initial={false}>
            {isOpen && (
              <motion.div id={`itinerary-editor-day-${index}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }} className="overflow-hidden">
              <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
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
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addDay}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary"
      >
        <Plus className="h-4 w-4" />
        Өдөр нэмэх
        {days.length > 0 && <span className="text-xs opacity-60">({days.length + 1} дэх өдөр)</span>}
      </button>
    </div>
  );
}
