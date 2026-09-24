import type { Metadata } from "next";

import { prisma } from "@/server/prisma";
import { DEFAULT_GIFT_BODY, DEFAULT_GIFT_TITLE } from "@/lib/siteContent";
import LeadForm from "@/components/lead/LeadForm";

export const metadata: Metadata = {
  title: "Аяллын бэлгийн эрхийн бичиг",
  description:
    "Хайртай хүндээ аялал бэлэглээрэй. Тодорхой аяллаар эсвэл өөрийн сонгосон дүнгээр эрхийн бичиг захиалах боломжтой.",
  openGraph: {
    title: "Аяллын бэлгийн эрхийн бичиг · Uudam Travel",
    description: "Хайртай хүндээ мартагдашгүй аялал бэлэглээрэй.",
    type: "website",
  },
};

/**
 * A request, not a purchase. Mongolayalal sells vouchers online; there is no
 * checkout here by design, so this captures the lead and staff arrange payment
 * the same way they close every other sale.
 */
export default async function GiftPage() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: "default" } });
  const title = settings?.giftTitle || DEFAULT_GIFT_TITLE;
  const body = settings?.giftBody || DEFAULT_GIFT_BODY;

  return (
    <div className="uudam-container max-w-2xl py-10">
      <header className="text-center">
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
      </header>

      <div className="mt-8">
        <LeadForm
          kind="GIFT"
          submitLabel="Эрхийн бичиг захиалах"
          successNote="Ажилтан тантай холбогдож эрхийн бичгийг бэлдэнэ. Хүсэлтийн дугаар:"
          fields={[
            {
              name: "giftAmount",
              label: "Ямар дүнгээр бэлэглэх вэ? (₮)",
              type: "number",
              placeholder: "1000000",
              hint: "Тодорхой аялал бэлэглэхийг хүсвэл доор аяллын нэрээ бичээрэй.",
              required: true,
            },
            {
              name: "giftRecipient",
              label: "Хүлээн авагчийн нэр",
              placeholder: "Болормаа",
            },
            {
              name: "message",
              label: "Бэлгийн мессеж эсвэл нэмэлт хүсэлт",
              type: "textarea",
              placeholder: "Эрхийн бичигт бичих мессеж, эсвэл сонирхож буй аяллын нэр…",
            },
          ]}
        />
      </div>
    </div>
  );
}
