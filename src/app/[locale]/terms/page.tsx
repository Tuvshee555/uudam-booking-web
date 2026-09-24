import type { Metadata } from "next";

import { prisma } from "@/server/prisma";
import { DEFAULT_TERMS_SECTIONS, parseTermsSections } from "@/lib/siteContent";

export const metadata: Metadata = {
  title: "Үйлчилгээний нөхцөл",
};

export default async function TermsPage() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: "default" } });
  const parsed = parseTermsSections(settings?.termsSections);
  const sections = parsed && parsed.length > 0 ? parsed : DEFAULT_TERMS_SECTIONS;

  return (
    <div className="uudam-container max-w-3xl py-12">
      <h1 className="text-3xl font-bold">Үйлчилгээний нөхцөл</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Сүүлд шинэчилсэн: {new Date().toLocaleDateString("mn-MN")}
      </p>

      <div className="mt-8 space-y-7">
        {sections.map((section, index) => (
          <section key={`${section.title}-${index}`}>
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
