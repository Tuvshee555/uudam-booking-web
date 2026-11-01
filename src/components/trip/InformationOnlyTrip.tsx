import Link from "next/link";
import { BedDouble, CalendarDays, Check, Clock, FileDown, X } from "lucide-react";

import { formatMnt } from "@/lib/pricing";
import { formatTripTitle } from "@/lib/tripDisplay";
import { splitHealthCheckup } from "@/lib/healthCheckup";
import { canonicalPath } from "@/lib/locales";
import type { Trip } from "@/types/trip";
import Breadcrumbs from "@/components/site/Breadcrumbs";
import TripGallery from "./TripGallery";
import ItineraryTimeline from "./ItineraryTimeline";
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
    <div className="rounded-xl border border-border bg-card p-6 shadow-panel">
      <div className="rounded-lg bg-gold/15 px-3 py-2 text-sm font-semibold text-foreground">
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
      <Link href="/mn/contact" className="mt-5 flex h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground focus-ring">
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

/**
 * A past programme kept public for reference (sourceMetadata.publicInfoOnly):
 * the full itinerary, clearly labelled as past, with no booking form.
 */
export default function InformationOnlyTrip({ trip, sourceMetadata }: { trip: Trip; sourceMetadata: unknown }) {
  const days = trip.itinerary.filter((day) => day.dayNumber > 0).sort((a, b) => a.dayNumber - b.dayNumber);
  const source = archiveDetails(sourceMetadata);
  const checkup = splitHealthCheckup(trip.description);
  const title = formatTripTitle(trip.title);

  return (
    <div className="site-container pb-20 pt-6 lg:pt-8">
      <Breadcrumbs
        items={[
          { label: "Нүүр", href: canonicalPath("") },
          { label: "Аялалууд", href: canonicalPath("/trips") },
          { label: "Хөтөлбөрийн танилцуулга" },
        ]}
      />

      <div className="mt-5"><TripGallery trip={trip} /></div>
      <p className="mt-2 text-[12.5px] text-muted-foreground">Зургууд нь аяллын чиглэлийн жишиг дүрслэл; энэ хөтөлбөрийн буудлын баталгаат зураг биш.</p>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-14">
          <header>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-gold/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-foreground">Өнгөрсөн хөтөлбөр</span>
              <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground"><Clock className="h-4 w-4" aria-hidden="true" />{days.length || trip.durationDays} өдөр</span>
              {trip.hotel && <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground"><BedDouble className="h-4 w-4" aria-hidden="true" />{trip.hotel}</span>}
            </div>
            <h1 className="display-1 mt-4 text-balance text-foreground">{title}</h1>
            {checkup.intro && <p className="lede mt-4 whitespace-pre-line">{checkup.intro}</p>}
          </header>

          <HealthCheckupSection lists={checkup.lists} />

          <div className="lg:hidden"><FarePanel trip={trip} source={source} /></div>

          {days.length > 0 && (
            <section id="itinerary" aria-labelledby="archive-itinerary" className="scroll-mt-28 border-t border-border pt-12">
              <h2 id="archive-itinerary" className="display-2 text-foreground">Өдөр тутмын хөтөлбөр</h2>
              <div className="mt-6"><ItineraryTimeline days={days} hotelLinks={[]} photoSource={trip} /></div>
            </section>
          )}

          {(trip.included.length > 0 || trip.excluded.length > 0) && (
            <section id="included" aria-label="Багц" className="grid scroll-mt-28 gap-6 border-t border-border pt-12 md:grid-cols-2">
              {trip.included.length > 0 && <div><h2 className="text-[17px] font-semibold text-foreground">Багцад багтсан</h2><ul className="mt-4 space-y-2.5">{trip.included.map((item) => <li key={item} className="flex items-start gap-2.5 text-[14.5px]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />{item}</li>)}</ul></div>}
              {trip.excluded.length > 0 && <div><h2 className="text-[17px] font-semibold text-foreground">Багцад ороогүй</h2><ul className="mt-4 space-y-2.5">{trip.excluded.map((item) => <li key={item} className="flex items-start gap-2.5 text-[14.5px] text-muted-foreground"><X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />{item}</li>)}</ul></div>}
            </section>
          )}

          <section id="important" className="scroll-mt-28 rounded-xl border border-gold/50 bg-gold/10 p-6">
            <h2 className="text-[17px] font-semibold text-foreground">Чухал мэдээлэл</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[14.5px] leading-relaxed text-foreground">
              <li>Энэ нь өнгөрсөн аяллын хөтөлбөр. Шинэ огноо, үнэ, суудал баталгаажаагүй тул онлайн захиалга авахгүй.</li>
              {source.durationNote && <li>{source.durationNote}</li>}
              {trip.hotel && <li>Зочид буудал: {trip.hotel}; нэр, өрөөний сонголт баталгаажаагүй.</li>}
            </ul>
          </section>
        </div>

        <aside className="hidden lg:block"><div className="sticky top-28"><FarePanel trip={trip} source={source} /></div></aside>
      </div>
    </div>
  );
}
