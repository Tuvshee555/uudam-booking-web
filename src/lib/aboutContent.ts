import {
  Award,
  Clock,
  Compass,
  Globe2,
  HeartHandshake,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AboutValue = { icon: string; title: string; text: string };

/**
 * A fixed key set, not a free icon-name string, so a typo in the admin form
 * can't silently drop a card's icon on the live page — an unknown key falls
 * back to Sparkles instead of rendering nothing.
 */
export const ABOUT_ICONS: Record<string, LucideIcon> = {
  globe: Globe2,
  compass: Compass,
  shield: ShieldCheck,
  heart: HeartHandshake,
  users: Users,
  clock: Clock,
  award: Award,
  phone: Phone,
  pin: MapPin,
  sparkles: Sparkles,
};

export const ABOUT_ICON_OPTIONS = Object.keys(ABOUT_ICONS) as (keyof typeof ABOUT_ICONS)[];

export function aboutIcon(key: string): LucideIcon {
  return ABOUT_ICONS[key] ?? Sparkles;
}

export const DEFAULT_ABOUT_HERO_TITLE = "Аялал бол зөвхөн газар биш — тэнд өнгөрүүлэх цаг";

export const DEFAULT_ABOUT_HERO_SUBTITLE =
  "Бид аяллын багцыг зохион байгуулж, нислэг, буудал, өдөр тутмын хөтөлбөрийг нэг дор шийдэж өгдөг. Та зөвхөн аяллаа мэдрэхэд л анхаарна.";

/**
 * Only what the site and the office demonstrably do. Claims about guides,
 * years in business or awards belong here only once staff write them in
 * (admin → Тохиргоо → Бидний тухай).
 */
export const DEFAULT_ABOUT_VALUES: AboutValue[] = [
  {
    icon: "shield",
    title: "Ил тод үнэ, нөхцөл",
    text: "Аялал бүрийн хуудсанд өдөр тутмын хөтөлбөр, огноо бүрийн үнэ, багцад багтсан ба ороогүй зүйлсийг тусад нь харуулдаг.",
  },
  {
    icon: "phone",
    title: "Хүнтэй шууд ярина",
    text: "Захиалга бүрийг манай ажилтан тантай холбогдож баталгаажуулдаг. Асуултаа утсаар, Messenger, WhatsApp-аар асууж болно.",
  },
  {
    icon: "heart",
    title: "Танд тохируулсан аялал",
    text: "Товлосон огноо тохирохгүй бол гэр бүл, найз нөхөд, хамт олондоо зориулж аялал зохион байгуулах хүсэлт авдаг.",
  },
  {
    icon: "compass",
    title: "Олон төрлийн аялал",
    text: "Шууд нислэгтэй, газрын, газар нислэг хосолсон, усан онгоцны аяллыг нэг дороос сонгоно.",
  },
];

/** Validates and clamps admin-submitted value cards — never trust JSON off the wire. */
export function parseAboutValues(value: unknown): AboutValue[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const cleaned = value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      icon: typeof item.icon === "string" && item.icon in ABOUT_ICONS ? item.icon : "sparkles",
      title: typeof item.title === "string" ? item.title.trim().slice(0, 120) : "",
      text: typeof item.text === "string" ? item.text.trim().slice(0, 400) : "",
    }))
    .filter((item) => item.title || item.text)
    .slice(0, 12);

  return cleaned;
}
