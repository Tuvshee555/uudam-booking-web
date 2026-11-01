import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";

import PageHero from "@/components/site/PageHero";
import { ChannelLink } from "@/components/site/channels";
import { prisma, withPrismaRetry } from "@/server/prisma";
import { GUIDE_SECTIONS, GUIDE_UPDATED } from "@/lib/guideContent";
import { fullDateTitle } from "@/lib/calendar";
import { canonicalPath } from "@/lib/locales";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Аялалд бэлтгэх",
  description: "Бичиг баримт, мөнгө, ачаа тээш, хөдлөх өдөр — аялахаас өмнө шалгах зүйлсийн жагсаалт ба аяллын зөвлөгөө.",
  ...shareMetadata("/guide", "Аялалд бэлтгэх · Uudam Travel", "Аялахаас өмнө шалгах зүйлсийн жагсаалт ба аяллын зөвлөгөө."),
};

/** Saving a post refreshes this page at once (revalidateGuidePages in /api/posts). */
export const revalidate = 86400;

export default async function GuideIndexPage() {
  const posts = await withPrismaRetry(() =>
    prisma.post.findMany({
      where: { isPublished: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, slug: true, title: true, excerpt: true, coverImage: true, publishedAt: true, createdAt: true },
    }),
  );

  return (
    <>
      <PageHero
        crumbs={[{ label: "Нүүр", href: canonicalPath("") }, { label: "Аялалд бэлтгэх" }]}
        eyebrow="Зөвлөгөө"
        title="Аялалд бэлтгэх"
        lede="Явахаас өмнө шалгах зүйлсийн жагсаалт. Ерөнхий зөвлөмж бөгөөд тухайн аяллын нөхцөлийг ажилтан тантай нарийвчлан тохирно."
      >
        <ul className="flex flex-wrap gap-2" aria-label="Агуулга">
          {GUIDE_SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-[13px] font-semibold text-foreground focus-ring hover:border-foreground/35">
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </PageHero>

      <div className="site-container grid gap-14 pb-20 pt-14 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-20">
        <div className="min-w-0 space-y-16">
          {GUIDE_SECTIONS.map((section, index) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-28">
              <p className="numeral text-[2.4rem] leading-none text-gold-text">{String(index + 1).padStart(2, "0")}</p>
              <h2 id={`${section.id}-title`} className="display-2 mt-3 text-foreground">{section.title}</h2>
              <p className="lede mt-3 max-w-2xl">{section.intro}</p>
              <ul className="mt-6 divide-y divide-border border-y border-border">
                {section.items.map((item) => (
                  <li key={item.title} className="grid gap-2 py-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-8">
                    <h3 className="text-[15px] font-semibold text-foreground">{item.title}</h3>
                    <p className="text-[15px] leading-relaxed text-ink-soft">{item.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p className="flex gap-3 rounded-xl border border-border bg-card p-5 text-[13.5px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-text" aria-hidden="true" />
            <span>
              Виз, бичиг баримт, гааль, ачааны албан ёсны шаардлагыг тухайн улсын эрх бүхий байгууллага, агаарын тээврийн компани тогтоодог бөгөөд өөрчлөгдөж болно. Аялал бүрийн шаардлагыг ажилтнаас баталгаажуулна уу.
              <span className="mt-2 block text-[12.5px]">Сүүлд шинэчилсэн: <time dateTime={GUIDE_UPDATED}>{fullDateTitle(`${GUIDE_UPDATED}T12:00:00+08:00`)}</time></span>
            </span>
          </p>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-xl surface-night p-6">
            <p className="eyebrow eyebrow-on-dark">Асуух зүйл байна уу</p>
            <p className="mt-3 font-display text-[1.45rem] leading-snug text-white">Аяллын бэлтгэлийг ажилтантай хамт шалгаарай</p>
            <ChannelLink channelKey="phone" from="guide" className="mt-5 flex h-11 items-center justify-center rounded-full bg-gold text-[14px] font-semibold text-navy-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              Залгах
            </ChannelLink>
            <ChannelLink channelKey="messenger" from="guide" className="mt-2 flex h-11 items-center justify-center rounded-full border border-white/30 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              Messenger-ээр бичих
            </ChannelLink>
          </div>
          <nav aria-label="Бусад мэдээлэл" className="rounded-xl border border-border bg-card p-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-foreground">Мөн үзэх</p>
            <ul className="mt-3 space-y-2 text-[14.5px]">
              <li><Link href={canonicalPath("/faq")} className="link-draw text-foreground">Түгээмэл асуулт</Link></li>
              <li><Link href={canonicalPath("/discover")} className="link-draw text-foreground">Танин мэдэхүй</Link></li>
              <li><Link href={canonicalPath("/departures")} className="link-draw text-foreground">Хөдлөх хуваарь</Link></li>
            </ul>
          </nav>
        </aside>
      </div>

      <section aria-labelledby="guide-posts" className="border-t border-border bg-sand/50 py-16 lg:py-20">
        <div className="site-container">
          <p className="eyebrow">Нийтлэл</p>
          <h2 id="guide-posts" className="display-2 mt-3 text-foreground">Аяллын зөвлөгөө</h2>
          {posts.length === 0 ? (
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Нийтлэл удахгүй нэмэгдэнэ. Тэр болтол{" "}
              <Link href={canonicalPath("/discover")} className="font-semibold text-foreground underline decoration-gold underline-offset-4">Танин мэдэхүй</Link>{" "}
              хэсгээс очих газруудын тухай уншаарай.
            </p>
          ) : (
            <ul className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <li key={post.id}>
                  <Link href={canonicalPath(`/guide/${post.slug}`)} className="group block focus-ring">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-sand">
                      {post.coverImage && <Image src={post.coverImage} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="photo-zoom object-cover" />}
                    </div>
                    <p className="mt-4 text-[12px] text-muted-foreground">{fullDateTitle(post.publishedAt ?? post.createdAt)}</p>
                    <h3 className="mt-1.5 text-[17px] font-semibold leading-snug text-foreground group-hover:underline group-hover:decoration-gold group-hover:underline-offset-4">{post.title}</h3>
                    {post.excerpt && <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-muted-foreground">{post.excerpt}</p>}
                    <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground">Унших <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
