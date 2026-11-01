import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";

import PageHero from "@/components/site/PageHero";
import { CONTACT, hasLink } from "@/lib/contact";
import { canonicalPath } from "@/lib/locales";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Хувийн мэдээлэл устгах",
  description: "Uudam Travel-д үлдээсэн хувийн мэдээллээ (нэр, утас, и-мэйл) устгуулах заавар.",
  ...shareMetadata("/data-deletion", "Хувийн мэдээлэл устгах · Uudam Travel", "Хувийн мэдээллээ устгуулах заавар."),
};

export default function DataDeletion() {
  return (
    <>
      <PageHero
        compact
        crumbs={[{ label: "Нүүр", href: canonicalPath("") }, { label: "Хувийн мэдээлэл устгах" }]}
        eyebrow="Хувийн мэдээлэл"
        title="Мэдээлэл устгах заавар"
        lede="Бидэнд үлдээсэн хувийн мэдээллээ (нэр, утасны дугаар, и-мэйл) устгуулахыг хүсвэл доорх хаягаар бидэнтэй холбогдоно уу. Хүсэлтийг хүлээн авснаас хойш ажлын 7 хоногт багтаан мэдээллийг устгана."
      />
      <div className="site-container max-w-2xl pb-20 pt-12">
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          {hasLink(CONTACT.email) ? (
            <>
              <Mail className="h-5 w-5 text-gold-text" aria-hidden="true" />
              <h2 className="mt-4 text-[15px] font-semibold text-foreground">Устгах хүсэлтээ илгээх и-мэйл</h2>
              <a href={`mailto:${CONTACT.email}?subject=${encodeURIComponent("Хувийн мэдээлэл устгах хүсэлт")}`} className="mt-2 inline-block font-display text-[1.5rem] text-foreground underline decoration-gold underline-offset-4 focus-ring">
                {CONTACT.email}
              </a>
              <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
                Хүсэлтдээ сайтад үлдээсэн нэр, утасны дугаараа бичвэл таны мэдээллийг олоход хялбар.
              </p>
            </>
          ) : (
            <p className="text-[14.5px] text-muted-foreground">
              Холбоо барих мэдээллийг{" "}
              <Link href={canonicalPath("/contact")} className="font-semibold text-foreground underline decoration-gold underline-offset-4">Холбоо барих</Link>{" "}
              хуудаснаас харна уу.
            </p>
          )}
        </div>
        <p className="mt-6 flex gap-3 text-[13.5px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          Сайтад үлдээсэн мэдээллийг зөвхөн таны хүсэлт, захиалгын талаар холбогдоход ашигладаг. Дэлгэрэнгүйг{" "}
          <Link href={canonicalPath("/terms")} className="underline underline-offset-2 hover:text-foreground">үйлчилгээний нөхцөл</Link>-өөс уншина уу.
        </p>
      </div>
    </>
  );
}
