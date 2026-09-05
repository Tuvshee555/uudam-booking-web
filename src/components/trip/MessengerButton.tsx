"use client";

import { MessageCircle } from "lucide-react";

import { CONTACT, hasLink } from "@/lib/contact";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * "Chat with a member of staff" — a direct line into Messenger, which is
 * where this agency actually answers customers. The enquiry form captures a
 * structured lead; this is the impatient path for someone who just wants to
 * ask one question, and it costs nothing to offer both.
 *
 * `tripSlug` is appended to the m.me link as a ref parameter, so staff can
 * see which trip a conversation opened from.
 */
export default function MessengerButton({
  tripSlug,
  tripId,
  variant = "inline",
  className,
}: {
  tripSlug?: string;
  tripId?: string;
  variant?: "inline" | "floating";
  className?: string;
}) {
  if (!hasLink(CONTACT.messenger)) return null;

  // m.me supports ?ref=… which Facebook passes through to the page inbox.
  const href = tripSlug
    ? `${CONTACT.messenger}${CONTACT.messenger.includes("?") ? "&" : "?"}ref=${encodeURIComponent(tripSlug)}`
    : CONTACT.messenger;

  const onClick = () => track("messenger_click", { tripId });

  if (variant === "floating") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={onClick}
        data-print="hide"
        aria-label="Ажилтантай чатлах"
        className={cn(
          "fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg transition-transform hover:scale-105",
          className,
        )}
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">Ажилтантай чатлах</span>
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      data-print="hide"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground",
        className,
      )}
    >
      <MessageCircle className="h-4 w-4" />
      Ажилтантай чатлах
    </a>
  );
}
