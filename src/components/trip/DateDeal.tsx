import { BRAND } from "@/lib/brand";
import { formatMnt } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { Departure } from "@/types/trip";

/**
 * The marks a date's own deal (lib/dateDeals.ts) puts next to its fare: the regular fare struck
 * through, a "−N%" chip, and «Онцлох». Pill-shaped on uudamtravel.mn, squared on Magnai like the
 * rest of its badges (TripCard's MagnaiTripCard).
 */

const CHIP = BRAND.key === "magnai" ? "rounded-sm tracking-[0.1em]" : "rounded-full tracking-wider";

/** The adult sale on this date, when one is in effect. */
export function dateSale(departure: Pick<Departure, "price" | "originalPrice" | "salePercent"> | null | undefined) {
  if (!departure || typeof departure.originalPrice !== "number" || typeof departure.price !== "number") return null;
  if (!(departure.price < departure.originalPrice)) return null;
  return { original: departure.originalPrice, percent: departure.salePercent ?? 0 };
}

/** The child sale on this date, when one is in effect. */
export function dateChildSale(departure: Pick<Departure, "childPrice" | "originalChildPrice"> | null | undefined) {
  if (!departure || typeof departure.originalChildPrice !== "number" || typeof departure.childPrice !== "number") return null;
  return departure.childPrice < departure.originalChildPrice ? { original: departure.originalChildPrice } : null;
}

export function SaleChip({ percent, className }: { percent: number; className?: string }) {
  if (!(percent > 0)) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums", CHIP, className)}>
      −{percent}%
    </span>
  );
}

export function FeaturedChip({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center bg-gold px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-navy-night", CHIP, className)}>
      Онцлох
    </span>
  );
}

/** The regular fare, struck through and muted; read out as the old price. */
export function WasPrice({ value, className }: { value: number; className?: string }) {
  return (
    <s className={cn("font-normal tabular-nums text-muted-foreground decoration-1", className)}>
      <span className="sr-only">Хуучин үнэ </span>
      {formatMnt(value)}
    </s>
  );
}
