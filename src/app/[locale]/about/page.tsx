import type { Metadata } from "next";

import { prisma } from "@/server/prisma";
import {
  aboutIcon,
  DEFAULT_ABOUT_HERO_SUBTITLE,
  DEFAULT_ABOUT_HERO_TITLE,
  DEFAULT_ABOUT_VALUES,
  parseAboutValues,
} from "@/lib/aboutContent";

export const metadata: Metadata = {
  title: "Бидний тухай",
  description: "Uudam Travel Agency — аяллын мэргэжлийн баг.",
};

export default async function AboutPage() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: "default" } });

  const heroTitle = settings?.aboutHeroTitle || DEFAULT_ABOUT_HERO_TITLE;
  const heroSubtitle = settings?.aboutHeroSubtitle || DEFAULT_ABOUT_HERO_SUBTITLE;
  const values = parseAboutValues(settings?.aboutValues) || [];
  const cards = values.length > 0 ? values : DEFAULT_ABOUT_VALUES;

  return (
    <div>
      <section className="border-b border-border bg-secondary/30">
        <div className="uudam-container py-16 md:py-20">
          <span className="uudam-eyebrow">Uudam Travel Agency</span>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
            {heroTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {heroSubtitle}
          </p>
        </div>
      </section>

      <section className="uudam-container py-14">
        <div className="grid gap-6 sm:grid-cols-2">
          {cards.map(({ icon, title, text }, index) => {
            const Icon = aboutIcon(icon);
            return (
              <div key={`${title}-${index}`} className="rounded-2xl border border-border p-6">
                <span className="inline-flex rounded-xl bg-primary/10 p-3 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
