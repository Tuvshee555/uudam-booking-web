"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { MessageSquareText, Phone, Search } from "lucide-react";

import MessengerIcon from "@/components/icons/MessengerIcon";
import { ChannelLink } from "@/components/site/channels";
import { channel } from "@/lib/channels";
import { canonicalPath } from "@/lib/locales";
import { useAdvisorChat } from "@/lib/chatStore";
import { cn } from "@/lib/utils";

/**
 * Hidden while a text field has focus: on phones the keyboard pushes a fixed
 * bar up over the very field being typed into.
 */
export function useTypingFocus(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (node: EventTarget | null) =>
      node instanceof HTMLElement && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName));
    const onIn = (event: FocusEvent) => setTyping(isField(event.target));
    const onOut = () => setTyping(false);
    window.addEventListener("focusin", onIn);
    window.addEventListener("focusout", onOut);
    return () => {
      window.removeEventListener("focusin", onIn);
      window.removeEventListener("focusout", onOut);
    };
  }, []);
  return typing;
}

export function BarIconLink({ children, label }: { children: ReactNode; label: string }) {
  return (
    <span className="flex flex-col items-center gap-1 text-[10.5px] font-medium leading-none">
      {children}
      {label}
    </span>
  );
}

/**
 * The phone's bottom bar: call, Messenger, the trip advisor, and the way into
 * the catalogue. Trip pages swap in their own bar with the price and "book".
 */
export default function MobileActionBar() {
  const typing = useTypingFocus();
  const toggleChat = useAdvisorChat((state) => state.toggle);
  const hasPhone = Boolean(channel("phone"));
  const hasMessenger = Boolean(channel("messenger"));

  return (
    <nav
      aria-label="Шуурхай холбоо"
      data-print="hide"
      className={cn(
        "site-theme fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md transition-transform duration-200 lg:hidden",
        typing && "translate-y-full",
      )}
    >
      <div className="mx-auto flex h-16 max-w-xl items-center gap-1 px-2">
        {hasPhone && (
          <ChannelLink channelKey="phone" from="mobile-bar" className="flex h-full flex-1 items-center justify-center rounded-lg text-foreground focus-ring">
            <BarIconLink label="Залгах">
              <Phone className="h-5 w-5" aria-hidden="true" />
            </BarIconLink>
          </ChannelLink>
        )}
        {hasMessenger && (
          <ChannelLink channelKey="messenger" from="mobile-bar" className="flex h-full flex-1 items-center justify-center rounded-lg text-foreground focus-ring">
            <BarIconLink label="Messenger">
              <MessengerIcon className="h-5 w-5" />
            </BarIconLink>
          </ChannelLink>
        )}
        <button type="button" onClick={toggleChat} className="flex h-full flex-1 items-center justify-center rounded-lg text-foreground focus-ring">
          <BarIconLink label="Зөвлөх">
            <MessageSquareText className="h-5 w-5" aria-hidden="true" />
          </BarIconLink>
        </button>
        <Link
          href={canonicalPath("/trips")}
          className="ml-1 flex h-11 flex-[1.6] items-center justify-center gap-2 whitespace-nowrap rounded-full bg-gold px-3 text-[14px] font-semibold text-navy-night min-[360px]:px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Search className="h-4 w-4 max-[359px]:hidden" aria-hidden="true" />
          Аялал хайх
        </Link>
      </div>
    </nav>
  );
}
