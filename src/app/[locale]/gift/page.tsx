import type { Metadata } from "next";

import PageHero from "@/components/site/PageHero";
import LeadForm from "@/components/lead/LeadForm";
import { getSiteSettings } from "@/server/siteSettings";
import { DEFAULT_GIFT_BODY, DEFAULT_GIFT_TITLE } from "@/lib/siteContent";
import { canonicalPath } from "@/lib/locales";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Аяллын бэлгийн эрхийн бичиг",
  description:
    "Хайртай хүндээ аялал бэлэглээрэй. Тодорхой аяллаар эсвэл өөрийн сонгосон дүнгээр эрхийн бичиг захиалах хүсэлт илгээнэ.",
  ...shareMetadata("/gift", "Аяллын бэлгийн эрхийн бичиг · Uudam Travel", "Хайртай хүндээ мартагдашгүй аялал бэлэглээрэй."),
};

export const revalidate = 86400;

/**
 * A request, not a purchase: there is no checkout here by design, so this
 * captures the lead and staff arrange payment the same way they close every
 * other sale.
 */
export default async function GiftPage() {
  const settings = await getSiteSettings();
  const title = settings?.giftTitle || DEFAULT_GIFT_TITLE;
  const body = settings?.giftBody || DEFAULT_GIFT_BODY;

  return (
    <>
      <PageHero
        compact
        crumbs={[{ label: "Нүүр", href: canonicalPath("") }, { label: "Аялал бэлэглэх" }]}
        eyebrow="Бэлгийн эрхийн бичиг"
        title={title}
        lede={body}
      />
      <div className="site-container max-w-2xl pb-20 pt-12">
        <LeadForm
          kind="GIFT"
          submitLabel="Эрхийн бичгийн хүсэлт илгээх"
          successNote="Ажилтан тантай холбогдож эрхийн бичиг, төлбөрийн нөхцөлийг тохирно. Хүсэлтийн дугаар:"
          fields={[
            { name: "giftAmount", label: "Ямар дүнгээр бэлэглэх вэ? (₮)", type: "number", placeholder: "1000000", hint: "Тодорхой аялал бэлэглэх бол доор аяллын нэрийг бичээрэй.", required: true },
            { name: "giftRecipient", label: "Хүлээн авагчийн нэр", placeholder: "Болормаа" },
            { name: "message", label: "Бэлгийн мессеж эсвэл нэмэлт хүсэлт", type: "textarea", placeholder: "Эрхийн бичигт бичих мессеж, эсвэл сонирхож буй аяллын нэр…" },
          ]}
        />
      </div>
    </>
  );
}
