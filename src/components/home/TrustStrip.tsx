import { CalendarCheck, Globe2 } from "lucide-react";

import { aboutIcon } from "@/lib/aboutContent";
import { CONTACT, formatPhone, hasLink } from "@/lib/contact";
import {
  DEFAULT_TRUST_FACTS,
  DEFAULT_TRUST_PHONE_TEXT,
  DEFAULT_TRUST_PHONE_TEXT_NO_PHONE,
  type TrustFact,
} from "@/lib/siteContent";

/**
 * Facts, not claims. The two numbers are counted from the live catalogue at
 * render time; the two statements are staff-editable (admin → Тохиргоо) and
 * default to things the site itself shows. No years in business, traveller
 * counts or awards — none of those are documented anywhere this site can check.
 */
export default function TrustStrip({
  tripCount,
  destinationCount,
  countryCount,
  openDepartures,
  facts,
  phoneText,
}: {
  tripCount: number;
  destinationCount: number;
  countryCount: number;
  openDepartures: number;
  facts?: TrustFact[];
  phoneText?: string | null;
}) {
  const phoneLine = (hasLink(CONTACT.phone) ? phoneText || DEFAULT_TRUST_PHONE_TEXT : DEFAULT_TRUST_PHONE_TEXT_NO_PHONE)
    .replace("{{phone}}", formatPhone(CONTACT.phone));
  const statements = (facts && facts.length ? facts : DEFAULT_TRUST_FACTS)
    .slice(0, 2)
    .map((fact) => ({ ...fact, text: fact.text.includes("{{phone}}") ? phoneLine : fact.text }));

  const items = [
    { icon: Globe2, value: `${tripCount}`, label: "аяллын багц", text: `${destinationCount} чиглэл, ${countryCount} улс`, figure: true },
    { icon: CalendarCheck, value: `${openDepartures}`, label: "нээлттэй хөдлөлт", text: "Ойрын 60 хоногт захиалга авч буй огноо", figure: true },
    ...statements.map((fact) => ({ icon: aboutIcon(fact.icon), value: fact.title, label: "", text: fact.text, figure: false })),
  ];

  return (
    <section aria-label="Uudam Travel товчхон" className="site-container pt-14 lg:pt-20">
      <ul className="grid grid-cols-2 gap-x-6 gap-y-10 border-y border-border py-10 lg:grid-cols-4 lg:divide-x lg:divide-border lg:py-12">
        {items.map(({ icon: Icon, value, label, text, figure }) => (
          <li key={`${value}-${label}`} className="lg:px-8 lg:first:pl-0">
            <Icon className="h-5 w-5 text-gold-text" aria-hidden="true" />
            <p className="mt-4 flex min-h-[2.5rem] flex-wrap items-baseline gap-x-2">
              {figure ? (
                <span className="numeral text-[2.4rem] leading-none text-foreground sm:text-[2.75rem]">{value}</span>
              ) : (
                <span className="font-display text-[1.35rem] leading-tight text-foreground sm:text-[1.6rem]">{value}</span>
              )}
              {label && <span className="text-sm font-semibold text-foreground">{label}</span>}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
