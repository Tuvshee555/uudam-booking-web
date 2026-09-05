"use client";

import { Download } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Opens the browser's print dialog, where every platform offers "Save as PDF"
 * (iOS: Share → Print → pinch out; Android/desktop: destination "Save as
 * PDF"). The print stylesheet in globals.css strips the site chrome so what
 * comes out is the trip itself — photos, day-by-day plan and prices — which
 * is the thing customers actually forward to each other.
 */
export default function DownloadTripButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      data-print="hide"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary hover:text-primary",
        className,
      )}
    >
      <Download className="h-3.5 w-3.5" />
      Татах
    </button>
  );
}
