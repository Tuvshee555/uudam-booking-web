"use client";

/**
 * The infant fare beside the others: its price when the trip gives one, otherwise a
 * «Тодруулж мэдээлэл аваарай» button that opens Messenger (the phone where Messenger is not set).
 * The owner's request, 2026-11-18: infant prices are often unknown (they depend on the day or the
 * seller), so say it plainly with a way to ask, everywhere an infant price is shown. The chatbot
 * says the same words with a «Нярайн үнэ тодруулах» button.
 */
import { MessageCircle, Phone } from "lucide-react";

import { ChannelLink } from "@/components/site/channels";
import { useChannel } from "@/components/site/ContactProvider";
import { INFANT_FARE_ASK, infantFareUnknown, passengerFareLabel } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export default function InfantFareAsk({
  sourceMetadata,
  price,
  tripId,
  from,
  className,
}: {
  sourceMetadata: Record<string, unknown> | null | undefined;
  price: number | null | undefined;
  tripId?: string;
  /** Where on the page it sits, for the funnel report. */
  from: string;
  className?: string;
}) {
  const messenger = useChannel("messenger");
  const phone = useChannel("phone");
  if (!infantFareUnknown(sourceMetadata, price)) return <>{passengerFareLabel(sourceMetadata, "infant", price)}</>;
  const key = messenger ? "messenger" : phone ? "phone" : null;
  if (!key) return <>{INFANT_FARE_ASK}</>;
  const Icon = key === "messenger" ? MessageCircle : Phone;
  return (
    <ChannelLink
      channelKey={key}
      tripId={tripId}
      from={`infant-fare-${from}`}
      ariaLabel={`Нярайн үнэ: ${INFANT_FARE_ASK}`}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[hsl(var(--uudam-navy)/0.25)] bg-[hsl(var(--uudam-navy)/0.06)] px-3 py-1 text-[12.5px] font-semibold leading-tight text-[hsl(var(--uudam-navy))] transition-colors hover:bg-[hsl(var(--uudam-navy)/0.12)] focus-ring",
        className,
      )}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{INFANT_FARE_ASK}</span>
    </ChannelLink>
  );
}
