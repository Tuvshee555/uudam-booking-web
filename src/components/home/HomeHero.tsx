"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, Compass, MapPin, Pause, Play, Search } from "lucide-react";

import { track } from "@/lib/analytics";
import { canonicalPath } from "@/lib/locales";
import { formatMnt } from "@/lib/pricing";
import { formatTripDuration, formatTripTitle } from "@/lib/tripDisplay";
import type { HeroSlide } from "@/lib/homeSections";
import { cn } from "@/lib/utils";
import Listbox from "@/components/ui/listbox";
import { BRAND } from "@/lib/brand";

const SLIDE_MS = 7000;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** The system's reduced-motion setting, read without a hydration mismatch (false on the server). */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

type Option = { value: string; label: string; count: number };

function Field({
  icon: Icon,
  label,
  id,
  value,
  onChange,
  placeholder,
  options,
}: {
  icon: typeof MapPin;
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Option[];
}) {
  return (
    <div id={id} className="relative flex min-w-0 flex-1">
      <Listbox
        value={value}
        options={[{ value: "", label: placeholder }, ...options.map((option) => ({ value: option.value, label: option.label, hint: String(option.count) }))]}
        onChange={onChange}
        ariaLabel={label}
        className="group flex min-w-0 flex-1 cursor-pointer flex-col justify-center px-5 py-3 text-left transition-colors hover:bg-secondary/50 focus:outline-none focus-visible:bg-secondary/70 aria-expanded:bg-secondary/70 lg:py-4"
      >
        {(selected) => (
          <>
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Icon className="h-3.5 w-3.5 text-gold-text" aria-hidden="true" />
              {label}
            </span>
            <span className="mt-1 block w-full truncate pr-6 text-[15px] font-semibold text-foreground">{selected?.label ?? placeholder}</span>
            <span aria-hidden="true" className="pointer-events-none absolute bottom-[1.1rem] right-5 h-1.5 w-1.5 rotate-45 border-b border-r border-muted-foreground lg:bottom-[1.35rem]" />
          </>
        )}
      </Listbox>
    </div>
  );
}

/**
 * The trip finder under the headline: where, when, what kind — all three
 * lists come from what is actually on sale, with counts, and it opens the
 * catalogue with those filters applied.
 */
function TripFinder({ destinations, months, categories, squared = false }: { destinations: Option[]; months: Option[]; categories: Option[]; squared?: boolean }) {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [month, setMonth] = useState("");
  const [category, setCategory] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (destination) params.set("dest", destination);
    if (month) params.set("month", month);
    if (category) params.set("cat", category);
    track("search_submit", { properties: { from: "home-finder", destination, month, category } });
    const query = params.toString();
    router.push(`${canonicalPath("/trips")}${query ? `?${query}` : ""}`);
  };

  return (
    <form
      onSubmit={submit}
      role="search"
      aria-label="Аялал хайх"
      className={cn(
        "site-theme flex flex-col divide-y divide-border overflow-hidden border bg-card text-foreground shadow-panel lg:flex-row lg:items-stretch lg:divide-x lg:divide-y-0",
        squared ? "rounded-md border-[hsl(var(--uudam-gold)/0.5)]" : "rounded-xl border-border",
      )}
    >
      <Field icon={MapPin} id="finder-destination" label="Хаашаа" value={destination} onChange={setDestination} placeholder="Бүх чиглэл" options={destinations} />
      <Field icon={CalendarDays} id="finder-month" label="Хэзээ" value={month} onChange={setMonth} placeholder="Ямар ч сар" options={months} />
      <Field icon={Compass} id="finder-category" label="Аяллын төрөл" value={category} onChange={setCategory} placeholder="Бүх төрөл" options={categories} />
      <div className="p-3 lg:flex lg:items-center lg:p-3">
        <button
          type="submit"
          className={cn(
            "flex h-12 w-full items-center justify-center gap-2 bg-gold px-8 text-[15px] font-semibold text-navy-night transition-colors hover:bg-[hsl(41_88%_55%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:h-14 lg:w-auto",
            squared ? "rounded-md" : "rounded-full",
          )}
        >
          <Search className="h-[18px] w-[18px]" aria-hidden="true" />
          Аялал хайх
        </button>
      </div>
    </form>
  );
}

export default function HomeHero({
  slides,
  eyebrow,
  title,
  titleAccent,
  subtitle,
  primaryCta,
  secondaryCta,
  finder,
}: {
  slides: HeroSlide[];
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  finder: { destinations: Option[]; months: Option[]; categories: Option[] };
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // A visitor who asked their system for less motion starts paused.
  const reducedMotion = usePrefersReducedMotion();
  const [pauseChoice, setPauseChoice] = useState<boolean | null>(null);
  const userPaused = pauseChoice ?? reducedMotion;
  const setUserPaused = (update: (value: boolean) => boolean) => setPauseChoice(update(userPaused));
  const count = slides.length;

  useEffect(() => {
    if (count <= 1 || paused || userPaused) return;
    const timer = window.setTimeout(() => setActive((current) => (current + 1) % count), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [active, count, paused, userPaused]);

  const current = slides[active];
  const next = count > 1 ? (active + 1) % count : -1;

  if (BRAND.key === "magnai") {
    return (
      <MagnaiHero
        slides={slides} active={active} next={next} count={count} paused={paused} userPaused={userPaused}
        setActive={setActive} setPaused={setPaused} togglePause={() => setUserPaused((value) => !value)}
        eyebrow={eyebrow} title={title} titleAccent={titleAccent} subtitle={subtitle}
        primaryCta={primaryCta} secondaryCta={secondaryCta} finder={finder}
      />
    );
  }

  return (
    <section aria-labelledby="home-hero-title" className="relative">
      <div
        className="relative isolate flex min-h-[600px] flex-col overflow-hidden bg-navy-night text-white h-[88svh] max-h-[880px] lg:min-h-[680px]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          {slides.map((slide, index) =>
            index === active || index === next ? (
              <div
                key={`${slide.image}-${index}`}
                className={cn("absolute inset-0 transition-opacity duration-[1400ms] ease-out", index === active ? "opacity-100" : "opacity-0")}
              >
                <Image
                  src={slide.image}
                  alt=""
                  fill
                  sizes="100vw"
                  quality={70}
                  priority={index === 0}
                  fetchPriority={index === 0 ? "high" : undefined}
                  className={cn("object-cover", index === active && "hero-settle")}
                />
              </div>
            ) : null,
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--uudam-night)/0.88)] via-[hsl(var(--uudam-night)/0.45)] to-[hsl(var(--uudam-night)/0.05)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--uudam-night)/0.85)] via-transparent to-[hsl(var(--uudam-night)/0.35)]" />
        </div>

        <div className="site-container relative flex flex-1 flex-col justify-end pb-10 pt-28 lg:pb-36">
          <div className="max-w-3xl">
            <p className="eyebrow eyebrow-on-dark rise">{eyebrow}</p>
            <h1 id="home-hero-title" className="display-hero rise rise-1 mt-5 text-balance text-white">
              {title}
              <span className="block text-gold">{titleAccent}</span>
            </h1>
            <p className="rise rise-2 mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/80 sm:text-lg">{subtitle}</p>
            <div className="rise rise-3 mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={canonicalPath("/trips")}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-gold px-7 text-[15px] font-semibold text-navy-night transition-colors hover:bg-[hsl(41_88%_55%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy-night"
              >
                {primaryCta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href={canonicalPath("/departures")}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/40 bg-white/5 px-6 text-[15px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-navy-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Хөдлөх хуваарь
              </Link>
              <Link href={canonicalPath("/contact")} className="link-draw ml-1 rounded-sm text-[15px] font-semibold text-white/85 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                {secondaryCta}
              </Link>
            </div>
          </div>

          {current?.trip && (
            <div className="rise rise-4 mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:absolute lg:bottom-36 lg:right-10 lg:mt-0 lg:w-[22rem] lg:flex-col lg:items-stretch">
              <Link
                href={canonicalPath(`/trips/${current.trip.slug}`)}
                className="group block rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-md transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:max-w-sm lg:max-w-none"
              >
                <span className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.2em] text-gold">
                  Зураг дээрх аялал{current.trip.place ? ` · ${current.trip.place}` : ""}
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
                <span className="mt-2 line-clamp-2 block text-[15px] font-semibold leading-snug text-white">{formatTripTitle(current.trip.title)}</span>
                <span className="mt-1.5 block text-[13px] text-white/70">
                  {[formatTripDuration(current.trip.durationDays, current.trip.durationNights), current.trip.price ? `${formatMnt(current.trip.price)}-с эхлэн` : ""].filter(Boolean).join(" · ")}
                </span>
              </Link>
              {count > 1 && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setUserPaused((value) => !value)}
                    aria-label={userPaused ? "Зургийг үргэлжлүүлэх" : "Зургийг зогсоох"}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 text-white/85 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    {userPaused ? <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5 fill-current" aria-hidden="true" />}
                  </button>
                  <ol className="flex flex-1 gap-1.5" aria-label="Зургууд">
                    {slides.map((slide, index) => (
                      <li key={`${slide.image}-dot-${index}`} className="flex-1">
                        <button
                          type="button"
                          onClick={() => setActive(index)}
                          aria-label={`${index + 1}-р зураг${slide.trip ? `: ${formatTripTitle(slide.trip.title)}` : ""}`}
                          aria-current={index === active}
                          className="group block w-full py-2 focus-visible:outline-none"
                        >
                          <span className="block h-[3px] overflow-hidden rounded-full bg-white/25 group-focus-visible:ring-2 group-focus-visible:ring-gold">
                            {index === active ? (
                              <span
                                key={`${active}-${paused || userPaused}`}
                                className={cn("block h-full bg-white", !(paused || userPaused) && "progress-fill")}
                                style={{ animationDuration: `${SLIDE_MS}ms`, transform: paused || userPaused ? "scaleX(1)" : undefined }}
                              />
                            ) : index < active ? (
                              <span className="block h-full bg-white/70" />
                            ) : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="site-container relative z-10 -mt-px pt-6 lg:-mt-[4.5rem] lg:pt-0">
        <TripFinder destinations={finder.destinations} months={finder.months} categories={finder.categories} />
      </div>
    </section>
  );
}

/**
 * Magnai's hero (lib/brand.ts): a midnight panel with the headline set in condensed capitals, the
 * photographs inside an arch (the logo's circle over its mountain), the featured trip on a card that
 * overlaps the arch, and the trip finder beneath. Same slides, copy, links and controls as Uudam's.
 */
function MagnaiHero({
  slides, active, next, count, paused, userPaused, setActive, setPaused, togglePause,
  eyebrow, title, titleAccent, subtitle, primaryCta, secondaryCta, finder,
}: {
  slides: HeroSlide[]; active: number; next: number; count: number; paused: boolean; userPaused: boolean;
  setActive: (index: number) => void; setPaused: (value: boolean) => void; togglePause: () => void;
  eyebrow: string; title: string; titleAccent: string; subtitle: string; primaryCta: string; secondaryCta: string;
  finder: { destinations: Option[]; months: Option[]; categories: Option[] };
}) {
  const current = slides[active];
  return (
    <section aria-labelledby="home-hero-title" className="relative isolate overflow-hidden bg-[hsl(var(--uudam-navy-deep))] text-white">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(60%_55%_at_78%_35%,hsl(var(--uudam-gold)/0.16),transparent_70%)]" />
      <svg aria-hidden="true" viewBox="0 0 1440 160" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 -z-10 h-28 w-full text-[hsl(var(--uudam-gold)/0.35)] lg:h-40">
        <path d="M0 150 L180 92 L300 128 L470 46 L610 112 L760 30 L900 104 L1040 64 L1180 120 L1310 80 L1440 118" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M0 160 L180 120 L300 146 L470 92 L610 138 L760 78 L900 132 L1040 100 L1180 146 L1310 116 L1440 140 L1440 160 Z" fill="hsl(var(--uudam-night) / 0.55)" />
      </svg>

      <div className="site-container grid items-center gap-12 pb-10 pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-14 lg:pt-32">
        <div className="max-w-2xl">
          <p className="eyebrow eyebrow-on-dark rise">{eyebrow}</p>
          <h1 id="home-hero-title" className="display-hero rise rise-1 mt-6 text-balance text-white">
            {title}
            <span className="mt-1 block text-gold">{titleAccent}</span>
          </h1>
          <p className="rise rise-2 mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/75 sm:text-lg">{subtitle}</p>
          <div className="rise rise-3 mt-9 flex flex-wrap items-center gap-3">
            <Link
              href={canonicalPath("/trips")}
              className="inline-flex h-12 items-center gap-2 rounded-md bg-gold px-7 text-[15px] font-semibold text-navy-night transition-colors hover:bg-[hsl(41_88%_55%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy-night"
            >
              {primaryCta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={canonicalPath("/departures")}
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[hsl(var(--uudam-gold)/0.55)] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[hsl(var(--uudam-gold)/0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <CalendarDays className="h-4 w-4 text-gold" aria-hidden="true" />
              Хөдлөх хуваарь
            </Link>
            <Link href={canonicalPath("/contact")} className="link-draw ml-1 rounded-sm text-[15px] font-semibold text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              {secondaryCta}
            </Link>
          </div>
        </div>

        <div
          className="rise rise-2 relative mx-auto w-full max-w-[22rem] pb-16 sm:max-w-[26rem] lg:mr-0 lg:max-w-[30rem]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <div aria-hidden="true" className="absolute -right-3 -top-3 bottom-[4.75rem] left-3 rounded-b-md rounded-t-[999px] border border-[hsl(var(--uudam-gold)/0.45)]" />
          <div className="relative aspect-[4/5] overflow-hidden rounded-b-md rounded-t-[999px] bg-navy-night shadow-[0_30px_80px_-30px_rgba(0,0,0,0.75)] ring-1 ring-white/10">
            {slides.map((slide, index) =>
              index === active || index === next ? (
                <div
                  key={`${slide.image}-${index}`}
                  className={cn("absolute inset-0 transition-opacity duration-[1400ms] ease-out", index === active ? "opacity-100" : "opacity-0")}
                >
                  <Image
                    src={slide.image}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 90vw, 480px"
                    quality={70}
                    priority={index === 0}
                    fetchPriority={index === 0 ? "high" : undefined}
                    className={cn("object-cover", index === active && "hero-settle")}
                  />
                </div>
              ) : null,
            )}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--uudam-night)/0.55)] via-transparent to-transparent" />
          </div>

          {current?.trip && (
            <Link
              href={canonicalPath(`/trips/${current.trip.slug}`)}
              className="group absolute inset-x-4 bottom-0 block rounded-md border-l-4 border-gold bg-white p-4 text-navy-night shadow-panel transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:-left-6 sm:right-10"
            >
              <span className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.2em] text-gold-text">
                Зураг дээрх аялал{current.trip.place ? ` · ${current.trip.place}` : ""}
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
              <span className="mt-1.5 line-clamp-2 block text-[15px] font-semibold leading-snug">{formatTripTitle(current.trip.title)}</span>
              <span className="mt-1 block text-[13px] text-navy-night/65">
                {[formatTripDuration(current.trip.durationDays, current.trip.durationNights), current.trip.price ? `${formatMnt(current.trip.price)}-с эхлэн` : ""].filter(Boolean).join(" · ")}
              </span>
            </Link>
          )}
        </div>
      </div>

      {count > 1 && (
        <div className="site-container -mt-2 flex items-center justify-center gap-2 pb-6 lg:justify-end">
          <button
            type="button"
            onClick={togglePause}
            aria-label={userPaused ? "Зургийг үргэлжлүүлэх" : "Зургийг зогсоох"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 text-white/85 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            {userPaused ? <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5 fill-current" aria-hidden="true" />}
          </button>
          <ol className="flex gap-1" aria-label="Зургууд">
            {slides.map((slide, index) => (
              <li key={`${slide.image}-dot-${index}`}>
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`${index + 1}-р зураг${slide.trip ? `: ${formatTripTitle(slide.trip.title)}` : ""}`}
                  aria-current={index === active}
                  className="group flex h-8 w-8 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <span
                    className={cn(
                      "block h-2 w-2 rotate-45 transition-colors",
                      index === active ? "bg-gold" : "bg-white/30 group-hover:bg-white/60",
                      index === active && !(paused || userPaused) && "animate-pulse",
                    )}
                  />
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="site-container relative z-10 pb-12 lg:pb-16">
        <TripFinder destinations={finder.destinations} months={finder.months} categories={finder.categories} squared />
      </div>
    </section>
  );
}
