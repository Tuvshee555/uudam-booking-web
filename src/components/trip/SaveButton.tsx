"use client";

import { Heart } from "lucide-react";

import { useSavedTrips } from "@/lib/saved";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export default function SaveButton({
  slug,
  variant = "icon",
  className,
}: {
  slug: string;
  /** `icon` sits on a card image; `button` sits beside the trip title. */
  variant?: "icon" | "button";
  className?: string;
}) {
  const { isSaved, toggle } = useSavedTrips();
  const saved = isSaved(slug);

  // Cards wrap the whole tile in a Link, so the click must not navigate.
  const onClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    toggle(slug);
    track("save_toggle", { properties: { slug, saved: !saved } });
  };

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={saved ? "Хадгалснаас хасах" : "Аяллыг хадгалах"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
          saved
            ? "border-destructive text-destructive"
            : "border-border hover:border-primary hover:text-primary",
          className,
        )}
      >
        <Heart className={cn("h-3.5 w-3.5", saved && "fill-current")} />
        {saved ? "Хадгалсан" : "Хадгалах"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? "Хадгалснаас хасах" : "Аяллыг хадгалах"}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", saved && "fill-destructive text-destructive")} />
    </button>
  );
}
