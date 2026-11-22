"use client";

/**
 * The phone numbers saved in admin Settings, handed to every browser-side component by the
 * storefront layout (app/[locale]/layout.tsx). Header, phone bars, booking and enquiry panels and
 * ChannelLink read them here, so a number changed in Settings reaches every call/WhatsApp button.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { buildChannels, type Channel, type ChannelKey } from "@/lib/channels";
import { DEFAULT_PHONES, type ContactPhones } from "@/lib/contact";

const ContactContext = createContext<ContactPhones>(DEFAULT_PHONES);

export function ContactProvider({ phones, children }: { phones: ContactPhones; children: ReactNode }) {
  return <ContactContext.Provider value={phones}>{children}</ContactContext.Provider>;
}

export function useContactPhones(): ContactPhones {
  return useContext(ContactContext);
}

export function useChannels(): Channel[] {
  const phones = useContactPhones();
  return useMemo(() => buildChannels(phones), [phones]);
}

export function useChannel(key: ChannelKey): Channel | undefined {
  return useChannels().find((entry) => entry.key === key);
}
