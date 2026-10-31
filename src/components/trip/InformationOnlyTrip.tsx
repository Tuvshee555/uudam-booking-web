import Link from "next/link";
import Image from "next/image";
import { BedDouble, CalendarDays, Check, Clock, FileDown, X } from "lucide-react";

import { formatMnt } from "@/lib/pricing";
import { formatTripTitle } from "@/lib/tripDisplay";
import { splitHealthCheckup } from "@/lib/healthCheckup";
import type { Trip } from "@/types/trip";
import TripMedia from "./TripMedia";
import HealthCheckupSection from "./HealthCheckupSection";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function archiveDetails(metadata: unknown) {
  const source = record(record(metadata).connectedSource);
  const archive = record(record(source.poster).public_archive);
  return {
    date: typeof archive.departure_date === "string" ? archive.departure_date : null,
    adult: typeof archive.adult_price === "number" ? archive.adult_price : null,
    childMin: typeof archive.child_price_min === "number" ? archive.child_price_min : null,
    childMax: typeof archive.child_price_max === "number" ? archive.child_price_max : null,
    childNote: typeof archive.child_price_note === "string" ? archive.child_price_note : null,
    infantNote: typeof archive.infant_price_note === "string" ? archive.infant_price_note : null,
    durationNote: typeof archive.duration_note === "string" ? archive.duration_note : null,
  };
}

function FarePanel({ trip, source }: { trip: Trip; source: ReturnType<typeof archiveDetails> }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
        Өнгөрсөн хөтөлбөр · Одоогоор захиалга авахгүй
      </div>
      <h2 className="mt-5 text-lg font-bold">PDF-д байсан огноо, үнэ</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Доорх нь өмнөх аяллын мэдээлэл. Шинэ гарах өдөр, үнэ, суудал баталгаажаагүй.</p>
      <dl className="mt-4 divide-y divide-border text-sm">
        <div className="flex items-start justify-between gap-3 py-3">
          <dt className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" />Явах өдөр</dt>
          <dd className="text-right font-semibold">{source.date ? `${source.date} (өнгөрсөн)` : "Заагаагүй"}</dd>
        </div>
        <div className="flex items-start justify-between gap-3 py-3">
          <dt className="text-muted-foreground">Том хүн</dt>
          <dd className="text-right font-bold">{source.adult !== null ? formatMnt(source.adult) : "Заагаагүй"}</dd>
        </div>
        <div className="flex items-start justify-between gap-3 py-3">
          <dt className="text-muted-foreground">Хүүхэд</dt>
          <dd className="text-right font-semibold">{source.childMin !== null && source.childMax !== null ? `${formatMnt(source.childMin)}–${formatMnt(source.childMax)}` : "Заагаагүй"}</dd>
        </div>
        <div className="flex items-start justify-between gap-3 py-3">
          <dt className="text-muted-foreground">Нярай</dt>
          <dd className="text-right font-semibold">Заагаагүй</dd>
        </div>
      </dl>
      {source.childNote && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{source.childNote}</p>}
      {source.infantNote && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{source.infantNote}</p>}
      <Link href="/mn/contact" className="mt-5 flex items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
        Шинэ аяллын талаар лавлах
      </Link>
      {trip.brochurePdfUrl && (
        <a href={trip.brochurePdfUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:underline">
          <FileDown className="h-4 w-4" /> PDF хөтөлбөрийг үзэх
        </a>
      )}
    </div>
  );
}

export default function InformationOnlyTrip({ trip, sourceMetadata }: { trip: Trip; sourceMetadata: unknown }) {
  const days = trip.itinerary.filter((day) => day.dayNumber > 0).sort((a, b) => a.dayNumber - b.dayNumber);
  const source = archiveDetails(sourceMetadata);
  const checkup = splitHealthCheckup(trip.description);

  return (
    <main className="uudam-container py-8 pb-16">
      <nav className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/mn" className="hover:text-primary">Нүүр</Link><span>/</span>
        <Link href="/mn/trips" className="hover:text-primary">Аялалууд</Link><span>/</span>
        <span>Хөтөлбөрийн танилцуулга</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <TripMedia trip={trip} />
          <p className="mt-2 text-xs text-muted-foreground">Зургууд нь аяллын чиглэлийн жишиг дүрслэл; энэ хөтөлбөрийн буудлын баталгаат зураг биш.</p>

          <header className="mt-6">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-950">Өнгөрсөн хөтөлбөр</span>
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-medium"><Clock className="h-3 w-3" />{days.length || trip.durationDays} өдөр</span>
              {trip.hotel && <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-medium"><BedDouble className="h-3 w-3" />{trip.hotel}</span>}
            </div>
            <h1 className="mt-3 text-2xl font-bold leading-tight md:text-3xl">{formatTripTitle(trip.title)}</h1>
            {checkup.intro && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">{checkup.intro}</p>}
          </header>

          <HealthCheckupSection lists={checkup.lists} />

          <div className="mt-5 lg:hidden"><FarePanel trip={trip} source={source} /></div>

          <nav aria-label="Хуудасны хэсгүүд" className="sticky top-[72px] z-20 -mx-4 mt-6 border-b border-border bg-background/95 px-4 backdrop-blur">
            <ul className="no-scrollbar flex gap-1 overflow-x-auto py-2 text-sm font-medium">
              <li><a href="#itinerary" className="inline-block rounded-full px-3 py-1.5 hover:bg-secondary">Хөтөлбөр</a></li>
              <li><a href="#included" className="inline-block rounded-full px-3 py-1.5 hover:bg-secondary">Багц</a></li>
              <li><a href="#important" className="inline-block rounded-full px-3 py-1.5 hover:bg-secondary">Чухал</a></li>
            </ul>
          </nav>

          <section id="itinerary" className="mt-8 scroll-mt-28">
            <h2 className="text-lg font-bold">Өдөр тутмын хөтөлбөр</h2>
            <ol className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
              {days.map((day, index) => (
                <li key={day.id}>
                  <details open={index === 0} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-secondary/50 sm:px-5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{day.dayNumber}</span>
                      <span className="flex-1 text-sm font-bold text-primary">{day.title}</span>
                      <span className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
                    </summary>
                    <div className="border-t border-border px-4 pb-4 pt-3 sm:px-5">
                      {day.description && <p className="whitespace-pre-line text-[15px] leading-7 text-foreground/80">{day.description}</p>}
                      {day.image && <div className="relative mt-3 aspect-[16/9] w-full max-w-xl overflow-hidden rounded-lg bg-secondary"><Image src={day.image} alt={day.title} fill sizes="(max-width: 640px) 100vw, 576px" className="object-cover" /></div>}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {day.meals.length > 0 && <span>Хоол: {day.meals.join(", ")}</span>}
                        {day.accommodation && <span>Буудал: {day.accommodation}</span>}
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </section>

          {(trip.included.length > 0 || trip.excluded.length > 0) && (
            <section id="included" className="mt-8 grid scroll-mt-28 gap-6 sm:grid-cols-2">
              {trip.included.length > 0 && <div><h2 className="text-lg font-bold">Багцад багтсан</h2><ul className="mt-3 space-y-2">{trip.included.map((item) => <li key={item} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul></div>}
              {trip.excluded.length > 0 && <div><h2 className="text-lg font-bold">Багцад ороогүй</h2><ul className="mt-3 space-y-2">{trip.excluded.map((item) => <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground"><X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />{item}</li>)}</ul></div>}
            </section>
          )}

          <section id="important" className="mt-8 scroll-mt-28 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <h2 className="text-lg font-bold">Чухал мэдээлэл</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              <li>Энэ нь өнгөрсөн аяллын PDF хөтөлбөр. Шинэ огноо, үнэ болон суудал баталгаажаагүй тул онлайн захиалга авахгүй.</li>
              {source.durationNote && <li>{source.durationNote}</li>}
              {trip.hotel && <li>Зочид буудал: {trip.hotel}; нэр, өрөөний сонголт баталгаажаагүй.</li>}
            </ul>
          </section>
        </div>

        <aside className="hidden lg:block"><div className="sticky top-24"><FarePanel trip={trip} source={source} /></div></aside>
      </div>
    </main>
  );
}
