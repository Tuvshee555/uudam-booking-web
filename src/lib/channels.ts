import type { ComponentType } from "react";
import { Facebook, Instagram, Mail, Phone } from "lucide-react";

import MessengerIcon from "@/components/icons/MessengerIcon";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import type { TrackedEvent } from "@/lib/analytics";
import { CONTACT, DEFAULT_PHONES, formatPhone, hasLink, telHref, whatsappHref, type ContactPhones } from "@/lib/contact";

export type ChannelKey = "phone" | "messenger" | "whatsapp" | "email" | "facebook" | "instagram";

export type Channel = {
  key: ChannelKey;
  label: string;
  /** What the visitor sees: the number, the address, the page name. */
  value: string;
  href: string;
  external: boolean;
  icon: ComponentType<{ className?: string }>;
  event?: TrackedEvent;
};

function handle(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

/**
 * Every way to reach a person at the agency, in the order customers use them.
 * Only channels with a real configured address are listed — no dead buttons.
 * The phone and WhatsApp follow the number saved in admin Settings (ContactPhones); the server
 * builds them from getContactPhones, the browser through ContactProvider's useChannels.
 */
export function buildChannels(phones: ContactPhones = DEFAULT_PHONES): Channel[] {
  const whatsapp = whatsappHref(phones.phone);
  return (
  [
    hasLink(phones.phone) && {
      key: "phone",
      label: "Утас",
      value: formatPhone(phones.phone),
      href: telHref(phones.phone),
      external: false,
      icon: Phone,
      event: "phone_click",
    },
    hasLink(CONTACT.messenger) && {
      key: "messenger",
      label: "Messenger",
      value: handle(CONTACT.messenger),
      href: CONTACT.messenger,
      external: true,
      icon: MessengerIcon,
      event: "messenger_click",
    },
    hasLink(whatsapp) && {
      key: "whatsapp",
      label: "WhatsApp",
      value: formatPhone(phones.phone) || handle(whatsapp),
      href: whatsapp,
      external: true,
      icon: WhatsAppIcon,
      event: "whatsapp_click",
    },
    hasLink(CONTACT.email) && {
      key: "email",
      label: "И-мэйл",
      value: CONTACT.email,
      href: `mailto:${CONTACT.email}`,
      external: false,
      icon: Mail,
      event: "email_click",
    },
    hasLink(CONTACT.facebook) && {
      key: "facebook",
      label: "Facebook",
      value: handle(CONTACT.facebook),
      href: CONTACT.facebook,
      external: true,
      icon: Facebook,
    },
    hasLink(CONTACT.instagram) && {
      key: "instagram",
      label: "Instagram",
      value: handle(CONTACT.instagram),
      href: CONTACT.instagram,
      external: true,
      icon: Instagram,
    },
  ] as (Channel | false)[]
  ).filter((entry): entry is Channel => Boolean(entry));
}

/** The channels with the default numbers (env); pages and components use the saved ones (buildChannels). */
export const CHANNELS: Channel[] = buildChannels();

export function channel(key: ChannelKey, list: Channel[] = CHANNELS): Channel | undefined {
  return list.find((entry) => entry.key === key);
}
