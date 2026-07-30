"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Compass, Headphones, PhoneCall, Sparkles } from "lucide-react";

import { useTrips, useCategoryTree } from "@/hooks/useTrips";
import TripCard from "@/components/trip/TripCard";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { Button } from "@/components/ui/button";

function TripGrid({ featured }: { featured?: boolean }) {
  const { data, isLoading } = useTrips(featured ? { featured: true } : undefined);

  if (isLoading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[380px] animate-pulse rounded-2xl bg-secondary" />
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        Одоогоор нийтлэгдсэн аялал алга байна.
      </p>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {data.slice(0, 8).map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  );
}

export default function HomePage() {
  const { locale } = useI18n();
  const base = `/${locale}`;
  const { data: categories } = useCategoryTree();

  return (
    <div>
      {/* Hero — navy field lifted straight from the logo, used once, at full
          strength, so the rest of the page can stay white. */}
      <section className="uudam-navy-surface relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=2000&q=80)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-deep via-navy-deep/80 to-transparent" />

        <div className="uudam-container relative py-20 md:py-28">
          <div className="max-w-2xl">
            <span className="uudam-eyebrow">Uudam Travel Agency</span>
            <h1 className="mt-3 text-4xl font-bold leading-[1.1] text-white md:text-5xl lg:text-6xl">
              Дараагийн аялалаа
              <span className="block text-gold">эндээс эхлүүл</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">
              Хөтөлбөр, үнэ, хөдлөх огноо, үлдсэн суудал — бүгд ил тод. Хүссэн аялалаа
              сонгоод шууд захиал.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gold text-navy-deep hover:bg-gold/90">
                <Link href={`${base}/trips`}>
                  Аялал үзэх
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href={`${base}/contact`}>Зөвлөгөө авах</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-border bg-secondary/30">
        <div className="uudam-container grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Compass, title: "Мэргэжлийн хөтөч", text: "Туршлагатай хөтөч дагалдана" },
            { icon: PhoneCall, title: "Ажилтантай шууд", text: "Утсаар холбогдож баталгаажуулна" },
            { icon: Sparkles, title: "Ил тод үнэ", text: "Нуугдмал төлбөргүй" },
            { icon: Headphones, title: "24/7 тусламж", text: "Аяллын турш холбоотой" },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-xs text-muted-foreground">{text}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      {categories && categories.length > 0 && (
        <section className="uudam-container py-14">
          <h2 className="text-2xl font-bold md:text-3xl">Чиглэлээр нь сонгох</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.slice(0, 8).map((category) => (
              <Link
                key={category.id}
                href={`${base}/category/${category.slug ?? category.id}`}
                className="group relative aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-secondary"
              >
                {category.image && (
                  <Image
                    src={category.image}
                    alt={category.categoryName}
                    fill
                    sizes="(max-width: 640px) 100vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/85 to-navy-deep/10" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="text-base font-semibold text-white">{category.categoryName}</div>
                  <div className="text-xs text-white/70">{category.tripCount} аялал</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      <section className="uudam-container pb-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="uudam-eyebrow text-primary">Онцлох</span>
            <h2 className="mt-1 text-2xl font-bold md:text-3xl">Хамгийн эрэлттэй аялалууд</h2>
          </div>
          <Link
            href={`${base}/trips`}
            className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:flex"
          >
            Бүгдийг үзэх
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6">
          <TripGrid featured />
        </div>
      </section>

      {/* All trips */}
      <section className="uudam-container py-14">
        <h2 className="text-2xl font-bold md:text-3xl">Шинэ аялалууд</h2>
        <div className="mt-6">
          <TripGrid />
        </div>

        <div className="mt-8 text-center">
          <Button asChild variant="outline" size="lg">
            <Link href={`${base}/trips`}>
              Бүх аяллыг үзэх
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
