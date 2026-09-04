import { MapPin, Phone, ShieldCheck } from "lucide-react";

import { CONTACT, hasLink } from "@/lib/contact";
import { prisma } from "@/server/prisma";

/**
 * Real, verifiable facts only — no "10 years in business", no "500+ happy
 * travelers", no staff photos. There is no public staff bio field in the
 * schema and total enquiries is currently 0, so any number beyond the trip
 * count itself would be invented. This deliberately says less than the
 * competitor trust blocks it was modeled after, because there is less here
 * that is actually true yet.
 */
export default async function TrustBar() {
  const tripCount = await prisma.trip.count({ where: { isPublished: true } });

  const facts = [
    {
      icon: ShieldCheck,
      title: "Ил тод үнэ",
      text: "Багцад юу багтсан, юу ороогүйг урьдчилан бүрэн харуулна.",
    },
    {
      icon: Phone,
      title: "Шууд холбогдоно",
      text: hasLink(CONTACT.phone)
        ? `${CONTACT.phone} дугаараар эсвэл Messenger-ээр ажилтантай шууд ярина.`
        : "Ажилтантай Messenger-ээр шууд холбогдоно.",
    },
    {
      icon: MapPin,
      title: `${tripCount} аяллын багц`,
      text: "Тухайн үед идэвхтэй санал болгож буй, ажилтнаар баталгаажсан хөтөлбөрүүд.",
    },
  ];

  return (
    <section className="border-y border-border bg-secondary/30">
      <div className="uudam-container grid gap-6 py-10 sm:grid-cols-3">
        {facts.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
