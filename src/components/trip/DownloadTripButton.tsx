"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Photos below the first screen are lazy-loaded, and the browser does not
 * fetch them for printing: the saved PDF showed an empty grey box for every
 * day photo the visitor had not scrolled past. Switch them to eager and wait
 * (bounded) until they have arrived before opening the print dialog.
 */
function loadEveryImage(timeoutMs: number): Promise<void> {
  const images = Array.from(document.images);
  for (const image of images) {
    if (image.loading === "lazy") image.loading = "eager";
  }
  const pending = images
    .filter((image) => !(image.complete && image.naturalWidth > 0))
    .map(
      (image) =>
        new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    );
  return Promise.race([
    Promise.all(pending).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Opens the browser's print dialog, where every platform offers "Save as PDF"
 * (iOS: Share → Print → pinch out; Android/desktop: destination "Save as
 * PDF"). The print stylesheet in globals.css strips the site chrome so what
 * comes out is the trip itself — photos, day-by-day plan and prices — which
 * is the thing customers actually forward to each other.
 */
export default function DownloadTripButton({ className }: { className?: string }) {
  const [preparing, setPreparing] = useState(false);

  // Ctrl+P / the browser menu skip this button; at least start the downloads.
  useEffect(() => {
    const onBeforePrint = () => void loadEveryImage(0);
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, []);

  const download = async () => {
    setPreparing(true);
    try {
      await loadEveryImage(8000);
    } finally {
      setPreparing(false);
    }
    window.print();
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={preparing}
      data-print="hide"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary hover:text-primary disabled:opacity-70",
        className,
      )}
    >
      {preparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {preparing ? "Бэлтгэж байна…" : "Татах"}
    </button>
  );
}
