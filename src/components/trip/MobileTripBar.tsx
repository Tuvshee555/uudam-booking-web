"use client";

import { Phone } from "lucide-react";

import MessengerIcon from "@/components/icons/MessengerIcon";
import { ChannelLink } from "@/components/site/channels";
import { useTypingFocus } from "@/components/layout/MobileActionBar";
import { channel } from "@/lib/channels";
import { formatMnt } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * A trip page's bottom bar on phones: the price, then call, Messenger, and
 * the way to the booking form further down the page.
 */
export default function MobileTripBar({
  tripId,
  price,
  priceLabel,
  status,
  tripSlug,
}: {
  tripId: string;
  price: number | null;
  priceLabel: string;
  status: "open" | "full" | "no-dates";
  tripSlug: string;
}) {
  const typing = useTypingFocus();
  const goToBooking = () => {
    const target = document.getElementById("booking");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => target?.querySelector<HTMLElement>("button, input, select")?.focus({ preventScroll: true }), 600);
  };

  return (
    <div
      data-print="hide"
      className={cn(
        "site-theme fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md transition-transform duration-200 lg:hidden",
        typing && "translate-y-full",
      )}
    >
      <div className="mx-auto flex h-16 max-w-xl items-center gap-2 px-3">
        <div className="min-w-0 flex-1">
          {price ? (
            <>
              <p className="text-[16px] font-bold leading-tight tabular-nums text-foreground">{formatMnt(price)}</p>
              <p className="truncate text-[11px] text-muted-foreground">{priceLabel}</p>
            </>
          ) : (
            <p className="text-[14px] font-semibold text-foreground">Үнэ лавлах</p>
          )}
        </div>
        {channel("phone") && (
          <ChannelLink channelKey="phone" tripId={tripId} from="trip-bar" ariaLabel="Залгах" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground focus-ring">
            <Phone className="h-[18px] w-[18px]" aria-hidden="true" />
          </ChannelLink>
        )}
        {channel("messenger") && (
          <ChannelLink channelKey="messenger" tripId={tripId} from="trip-bar" ariaLabel={`Messenger · ${tripSlug}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground focus-ring">
            <MessengerIcon className="h-[18px] w-[18px]" />
          </ChannelLink>
        )}
        <button
          type="button"
          onClick={goToBooking}
          className="flex h-11 shrink-0 items-center justify-center rounded-full bg-gold px-5 text-[14px] font-semibold text-navy-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {status === "open" ? "Захиалах" : "Асуух"}
        </button>
      </div>
    </div>
  );
}
