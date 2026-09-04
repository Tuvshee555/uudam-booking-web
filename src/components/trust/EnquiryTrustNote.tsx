"use client";

import { MessageCircle, Phone, ShieldCheck } from "lucide-react";

import { CONTACT, hasLink } from "@/lib/contact";

/**
 * Sits directly under the enquiry form — the moment someone decides whether
 * to hand over a phone number. Client-safe (no Prisma call, unlike TrustBar):
 * this renders inside TripDetailClient, which is a Client Component.
 */
export default function EnquiryTrustNote() {
  return (
    <div className="mt-3 space-y-1.5 rounded-xl border border-border bg-secondary/30 p-3.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
        Таны дугаарыг зөвхөн энэ аяллын талаар холбогдоход ашиглана.
      </div>
      {(hasLink(CONTACT.phone) || hasLink(CONTACT.messenger)) && (
        <div className="flex items-center gap-1.5">
          {hasLink(CONTACT.phone) ? (
            <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
          ) : (
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          Хүсвэл {hasLink(CONTACT.phone) ? CONTACT.phone : "Messenger"}-ээр шууд бичиж болно.
        </div>
      )}
    </div>
  );
}
