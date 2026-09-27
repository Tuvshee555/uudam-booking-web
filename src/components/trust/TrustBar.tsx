import { MapPin, Phone } from "lucide-react";

import { CONTACT, hasLink } from "@/lib/contact";
import { prisma } from "@/server/prisma";
import { getSiteSettings } from "@/server/siteSettings";
import { aboutIcon } from "@/lib/aboutContent";
import {
  DEFAULT_TRUST_FACTS,
  DEFAULT_TRUST_PHONE_TEXT,
  DEFAULT_TRUST_PHONE_TEXT_NO_PHONE,
  parseTrustFacts,
} from "@/lib/siteContent";

/**
 * Real, verifiable facts only — no "10 years in business", no "500+ happy
 * travelers", no staff photos. There is no public staff bio field in the
 * schema and total enquiries is currently 0, so any number beyond the trip
 * count itself would be invented. This deliberately says less than the
 * competitor trust blocks it was modeled after, because there is less here
 * that is actually true yet.
 *
 * The first 2 facts and the phone fact's text are admin-editable (see
 * /admin/settings); the trip-count fact stays hardcoded to a live query on
 * purpose — it's the one number that must never drift from reality.
 */
export default async function TrustBar({
  settings,
}: {
  settings?: Awaited<ReturnType<typeof getSiteSettings>>;
}) {
  const tripCount = await prisma.trip.count({ where: { isPublished: true } });

  const editableFacts = parseTrustFacts(settings?.trustFacts);
  const facts = editableFacts && editableFacts.length > 0 ? editableFacts : DEFAULT_TRUST_FACTS;

  const phoneTemplate = hasLink(CONTACT.phone)
    ? (settings?.trustPhoneText || DEFAULT_TRUST_PHONE_TEXT)
    : DEFAULT_TRUST_PHONE_TEXT_NO_PHONE;
  const phoneText = phoneTemplate.replace("{{phone}}", CONTACT.phone || "");

  return (
    <section className="border-b border-border bg-secondary/30">
      <div className="uudam-container grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(({ icon, title, text }, index) => {
          const Icon = aboutIcon(icon);
          return (
            <div key={`${title}-${index}`} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">{title}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </div>
          );
        })}

        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Phone className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-semibold">Шууд холбогдоно</div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{phoneText}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-semibold">{tripCount} аяллын багц</div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Тухайн үед идэвхтэй санал болгож буй, ажилтнаар баталгаажсан хөтөлбөрүүд.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
