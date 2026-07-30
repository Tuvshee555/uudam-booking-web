import type { Metadata } from "next";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { CONTACT, hasLink } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Мэдээлэл устгах",
  description: "Хувийн мэдээллээ устгуулах заавар.",
};

export default async function DataDeletion({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="uudam-container max-w-2xl py-14">
      <span className="inline-flex rounded-xl bg-primary/10 p-3 text-primary">
        <Trash2 className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-2xl font-bold md:text-3xl">Мэдээлэл устгах заавар</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Бидэнд үлдээсэн хувийн мэдээллээ (нэр, утасны дугаар, и-мэйл) устгуулахыг хүсвэл
        доорх хаягаар бидэнтэй холбогдоно уу. Хүсэлтийг хүлээн авснаас хойш ажлын 7
        хоногт багтаан мэдээллийг устгана.
      </p>

      <div className="mt-6 rounded-2xl border border-border p-5">
        {hasLink(CONTACT.email) ? (
          <>
            <div className="text-sm font-semibold">И-мэйл хаяг</div>
            <a
              href={`mailto:${CONTACT.email}`}
              className="mt-1 block text-sm text-primary hover:underline"
            >
              {CONTACT.email}
            </a>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Холбоо барих мэдээллийг{" "}
            <Link href={`/${locale}/contact`} className="text-primary hover:underline">
              Холбоо барих
            </Link>{" "}
            хуудаснаас харна уу.
          </p>
        )}
      </div>
    </div>
  );
}
