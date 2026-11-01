import { cn } from "@/lib/utils";

/**
 * The logo's gold sun inside its ring, as a small mark for labels and bullets.
 */
export function SunMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("h-4 w-4", className)}>
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
      <circle cx="12" cy="12" r="5" fill="hsl(var(--uudam-gold))" />
    </svg>
  );
}

/**
 * A sun on the horizon with concentric arcs rising from it — the logo's
 * composition opened out into a decorative field for dark bands. Purely
 * ornamental; it sits behind content at low opacity.
 */
export function HorizonArcs({ className }: { className?: string }) {
  const radii = [90, 150, 215, 285, 360, 440, 525];
  return (
    <svg
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className={cn("pointer-events-none", className)}
    >
      {radii.map((radius, index) => (
        <circle
          key={radius}
          cx="600"
          cy="600"
          r={radius}
          fill="none"
          stroke="hsl(41 87% 62%)"
          strokeOpacity={0.32 - index * 0.035}
          strokeWidth="1"
        />
      ))}
      <circle cx="600" cy="600" r="46" fill="hsl(41 87% 62%)" fillOpacity="0.9" />
    </svg>
  );
}
