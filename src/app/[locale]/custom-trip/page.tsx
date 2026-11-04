import type { Metadata } from "next";
import { CalendarRange, MessageSquareText, Route } from "lucide-react";

import PageHero from "@/components/site/PageHero";
import LeadForm from "@/components/lead/LeadForm";
import { getSiteSettings } from "@/server/siteSettings";
import { getTripSummaries } from "@/server/catalog";
import { renderTime } from "@/server/clock";
import { heroSlides } from "@/lib/homeSections";
import { DEFAULT_CUSTOM_TRIP_BODY, DEFAULT_CUSTOM_TRIP_TITLE } from "@/lib/siteContent";
import { canonicalPath } from "@/lib/locales";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Захиалгат аялал",
  description:
    "Товлосон огноо тохирохгүй байна уу? Гэр бүл, найз нөхөд, хамт олондоо зориулж өөрийн огноо, чиглэлээр аялал захиалаарай.",
  ...shareMetadata("/custom-trip", "Захиалгат аялал · Uudam Travel", "Өөрийн огноо, өөрийн хүмүүстэй аялал зохион байгуулна."),
};

export const revalidate = 86400;

const STEPS = [
  { icon: MessageSquareText, title: "Хүсэлтээ үлдээнэ", text: "Хаашаа, хэзээ, хэдүүлээ явахаа бичнэ. Тодорхой огноо мэдэхгүй бол «уян хатан» гэж бичихэд болно." },
  { icon: Route, title: "Хөтөлбөрийн санал авна", text: "Ажилтан тантай холбогдож хүсэлтийг тань тодруулаад хөтөлбөр, үнийн санал бэлдэнэ." },
  { icon: CalendarRange, title: "Тохирсны дараа баталгаажна", text: "Хөтөлбөр, үнэ, нөхцөлийг тохирсны дараа л захиалга баталгаажина." },
];

/**
 * The "dates don't work" escape hatch: a visitor whose schedule misses every
 * departure — or whose trip is not in the catalogue — asks for one instead.
 */
export default async function CustomTripPage() {
  const [settings, trips] = await Promise.all([getSiteSettings(), getTripSummaries()]);
  const title = settings?.customTripTitle || DEFAULT_CUSTOM_TRIP_TITLE;
  const body = settings?.customTripBody || DEFAULT_CUSTOM_TRIP_BODY;
  const image = heroSlides(trips, renderTime(), [], 4)[3]?.image ?? null;

  return (
    <>
      <PageHero
        crumbs={[{ label: "Нүүр", href: canonicalPath("") }, { label: "Захиалгат аялал" }]}
        eyebrow="Захиалгат аялал"
        title={title}
        lede={body}
        image={image}
      />

      <div className="site-container grid gap-12 pb-20 pt-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16 lg:pt-16">
        <div>
          <h2 className="display-3 text-foreground">Хэрхэн явагдах вэ</h2>
          <ol className="mt-6 space-y-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-gold-text">
                  <step.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-[16px] font-semibold text-foreground">{index + 1}. {step.title}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <LeadForm
          kind="CUSTOM"
          submitLabel="Хүсэлт илгээх"
          successNote="Ажилтан тантай холбогдож хөтөлбөр, үнийн санал бэлдэнэ. Хүсэлтийн дугаар:"
          fields={[
            { name: "destination", label: "Хаашаа явахыг хүсэж байна вэ?", placeholder: "Жишээ нь: Япон, Токио", required: true },
            { name: "preferredDates", label: "Хэзээ явах вэ?", placeholder: "10-р сарын дунд, эсвэл уян хатан", hint: "Тодорхой огноо мэдэхгүй бол «уян хатан» гэж бичиж болно.", required: true },
            { name: "adults", label: "Хэдэн хүн явах вэ?", type: "number", placeholder: "4" },
            { name: "budgetPerPerson", label: "Нэг хүний ойролцоо төсөв (₮)", type: "number", placeholder: "3500000", hint: "Ойролцоо дүн хэлбэл тохирох хувилбар санал болгоход хялбар." },
            { name: "message", label: "Нэмэлт хүсэлт", type: "textarea", placeholder: "Зочид буудлын түвшин, хүүхэдтэй эсэх, онцгой хүсэлт…" },
          ]}
        />
      </div>
    </>
  );
}
