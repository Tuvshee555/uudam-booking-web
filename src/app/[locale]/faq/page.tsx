import type { Metadata } from "next";

import { prisma } from "@/server/prisma";
import { CONTACT, hasLink } from "@/lib/contact";
import { DEFAULT_FAQS, parseFaqs } from "@/lib/siteContent";

export const metadata: Metadata = {
  title: "Түгээмэл асуулт",
  description: "Uudam Travel Agency-тэй холбоотой түгээмэл асуултууд.",
};

export default async function FaqPage() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: "default" } });
  const parsed = parseFaqs(settings?.faqs);
  const faqs = parsed && parsed.length > 0 ? parsed : DEFAULT_FAQS;

  return (
    <div className="uudam-container max-w-3xl py-12">
      <h1 className="text-3xl font-bold">Түгээмэл асуулт</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Хамгийн олон асуудаг зүйлсэд хариулъя. Хариулт олдохгүй бол шууд холбогдоорой.
      </p>

      <div className="mt-8 divide-y divide-border rounded-2xl border border-border">
        {faqs.map((item, index) => (
          <details key={`${item.q}-${index}`} className="group px-5 py-4 open:pb-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold marker:content-none">
              {item.q}
              <span className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>

      {hasLink(CONTACT.phone) && (
        <p className="mt-6 text-sm text-muted-foreground">
          Хариулт олдсонгүй юу?{" "}
          <a href={CONTACT.phoneHref} className="font-medium text-primary hover:underline">
            Утсаар холбогдоно уу
          </a>
          .
        </p>
      )}
    </div>
  );
}
