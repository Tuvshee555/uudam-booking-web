"use client";

import type { ReactNode } from "react";

import { track } from "@/lib/analytics";
import { channel as findChannel, type ChannelKey } from "@/lib/channels";

/**
 * An anchor for one contact channel that records which channel was used
 * (never what was said). Takes the channel's key so a server component can
 * render it; returns nothing when that channel is not configured.
 */
export function ChannelLink({
  channelKey,
  className,
  children,
  tripId,
  ariaLabel,
  from,
}: {
  channelKey: ChannelKey;
  className?: string;
  children: ReactNode;
  tripId?: string;
  ariaLabel?: string;
  /** Where on the site the tap happened, for the funnel report. */
  from?: string;
}) {
  const entry = findChannel(channelKey);
  if (!entry) return null;
  return (
    <a
      href={entry.href}
      {...(entry.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      aria-label={ariaLabel}
      onClick={() => entry.event && track(entry.event, { tripId, properties: from ? { from } : undefined })}
      className={className}
    >
      {children}
    </a>
  );
}
