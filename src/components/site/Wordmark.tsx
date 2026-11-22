import Image from "next/image";

import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/** The logo roundel with the brand lockup beside it (UUDAM / TRAVEL AGENCY, MAGNAI / TRAVEL — lib/brand.ts). */
export default function Wordmark({ tone = "dark", compact = false }: { tone?: "dark" | "light"; compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <Image
        src={BRAND.mark}
        alt=""
        width={44}
        height={44}
        priority
        // A 3 KB mark sized for its 2x display; nothing for the image service to do.
        unoptimized
        className={cn("rounded-full ring-1", compact ? "h-9 w-9" : "h-10 w-10 lg:h-11 lg:w-11", tone === "light" ? "ring-white/40" : "ring-black/5")}
      />
      <span className="flex flex-col leading-none">
        <span className={cn("text-[15px] font-extrabold tracking-[0.2em]", tone === "light" ? "text-white" : "text-foreground")}>{BRAND.wordmark}</span>{" "}
        <span className={cn("mt-1 text-[8.5px] font-semibold uppercase tracking-[0.34em]", tone === "light" ? "text-gold" : "text-gold-text")}>
          {BRAND.wordmarkTagline}
        </span>
      </span>
    </span>
  );
}
