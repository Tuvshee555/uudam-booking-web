"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

/**
 * The agency sells in Facebook Messenger, so a shared trip link is the single
 * most common way a customer meets this page. Making the visitor select the
 * address bar on a phone was the friction; the native share sheet puts
 * Messenger one tap away, and clipboard is the desktop fallback.
 */
export default function ShareButton({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        // A cancelled share sheet is a normal outcome, not a failure — fall
        // through to copying only when the sheet actually errored.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Холбоос хуулагдлаа");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Холбоос хуулж чадсангүй");
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Аяллыг хуваалцах"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary hover:text-primary",
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      Хуваалцах
    </button>
  );
}
