"use client";

/**
 * On the page of a trip whose dates have ended (InformationOnlyTrip): the owner's offer, 2026-11-22, that a group of
 * ten or more (a company, an organisation) can still go on this trip on a date they choose, with a way to ask.
 * The chatbot says the same words about an ended trip (chatbot endedTrip.ts). The note comes from the chatbot's sync.
 */
import { MessageCircle, Phone, Users } from "lucide-react";

import { ChannelLink } from "@/components/site/channels";
import { useChannel } from "@/components/site/ContactProvider";

export default function EndedTripGroupOffer({ note, tripId }: { note: string; tripId: string }) {
  const messenger = useChannel("messenger");
  const phone = useChannel("phone");
  const button = "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors focus-ring";
  return (
    <div className="mt-5 rounded-lg border border-[hsl(var(--uudam-navy)/0.2)] bg-[hsl(var(--uudam-navy)/0.05)] p-4">
      <p className="flex items-start gap-2 text-[14px] font-semibold leading-relaxed text-foreground">
        <Users aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--uudam-navy))]" />
        <span>{note}</span>
      </p>
      {(messenger || phone) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {messenger && (
            <ChannelLink channelKey="messenger" tripId={tripId} from="ended-trip-group" ariaLabel="Группээр явах талаар Messenger-ээр лавлах"
              className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`}>
              <MessageCircle aria-hidden="true" className="h-4 w-4" /> Группээр лавлах
            </ChannelLink>
          )}
          {phone && (
            <ChannelLink channelKey="phone" tripId={tripId} from="ended-trip-group" ariaLabel="Группээр явах талаар залгах"
              className={`${button} border border-border bg-card text-foreground hover:bg-muted`}>
              <Phone aria-hidden="true" className="h-4 w-4" /> Залгах
            </ChannelLink>
          )}
        </div>
      )}
    </div>
  );
}
