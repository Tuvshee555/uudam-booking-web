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
          "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors focus-ring",
          saved
            ? "border-destructive/40 bg-destructive/5 text-destructive"
            : "border-border bg-card text-foreground hover:border-foreground/35",
          className,
        )}
      >
        <Heart className={cn("h-4 w-4", saved && "fill-current")} aria-hidden="true" />
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
        "flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-navy-night shadow-sm backdrop-blur transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", saved && "fill-destructive text-destructive")} aria-hidden="true" />
    </button>
  );
}
