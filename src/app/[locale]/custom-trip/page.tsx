import type { Metadata } from "next";

import { prisma } from "@/server/prisma";
import { DEFAULT_CUSTOM_TRIP_BODY, DEFAULT_CUSTOM_TRIP_TITLE } from "@/lib/siteContent";
import LeadForm from "@/components/lead/LeadForm";

export const metadata: Metadata = {
  title: "Захиалгат аялал",
  description:
    "Товлосон огноо тохирохгүй байна уу? Гэр бүл, найз нөхөд, байгууллагадаа зориулж өөрийн бүрэлдэхүүнтэй аялал захиалаарай.",
  openGraph: {
    title: "Захиалгат аялал · Uudam Travel",
    description: "Өөрийн огноо, өөрийн хүмүүстэй аялал зохион байгуулна.",
    type: "website",
  },
};

/**
 * The "dates don't work" escape hatch. Without it a visitor whose schedule
 * misses every departure simply leaves — and 11 of the catalogue's trips have
 * no published departure at all, so that visitor is not rare.
 */
export default async function CustomTripPage() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: "default" } });
  const title = settings?.customTripTitle || DEFAULT_CUSTOM_TRIP_TITLE;
  const body = settings?.customTripBody || DEFAULT_CUSTOM_TRIP_BODY;

  return (
    <div className="uudam-container max-w-2xl py-10">
      <header className="text-center">
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
      </header>

      <div className="mt-8">
        <LeadForm
          kind="CUSTOM"
          submitLabel="Хүсэлт илгээх"
          successNote="Ажилтан тантай холбогдож хөтөлбөр, үнийн санал бэлдэнэ. Хүсэлтийн дугаар:"
          fields={[
            {
              name: "destination",
              label: "Хаашаа явахыг хүсэж байна вэ?",
              placeholder: "Жишээ нь: Япон, Токио",
              required: true,
            },
            {
              name: "preferredDates",
              label: "Хэзээ?",
              placeholder: "10-р сарын дунд, эсвэл уян хатан",
              hint: "Тодорхой огноо мэдэхгүй бол \"уян хатан\" гэж бичиж болно.",
              required: true,
            },
            {
              name: "adults",
              label: "Хэдэн хүн явах вэ?",
              type: "number",
              placeholder: "4",
            },
            {
              name: "budgetPerPerson",
              label: "Нэг хүний ойролцоо төсөв (₮)",
              type: "number",
              placeholder: "3500000",
              hint: "Ойролцоо дүн хэлбэл тохирох хувилбар санал болгоход хялбар.",
            },
            {
              name: "message",
              label: "Нэмэлт хүсэлт",
              type: "textarea",
              placeholder: "Зочид буудлын түвшин, хүүхэдтэй эсэх, онцгой хүсэлт…",
            },
          ]}
        />
      </div>
    </div>
  );
}
