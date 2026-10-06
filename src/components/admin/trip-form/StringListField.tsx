"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Add-on-Enter tag list, for arrays like highlights, included, transport… */
export default function StringListField({
  label,
  values,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...values, trimmed]);
    setDraft("");
  }

  return (
    <div>
      <Label>{label}</Label>
      {hint && <p className="mb-1.5 mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="flex gap-2">
        <Input
          aria-label={label}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          title="Нэмэх"
          aria-label={`${label} нэмэх`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input hover:bg-secondary disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="inline-flex max-w-full items-center gap-2 rounded-md bg-secondary px-2.5 py-1.5 text-xs"
            >
              <span className="min-w-0 break-words">{value}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`${value} хасах`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
