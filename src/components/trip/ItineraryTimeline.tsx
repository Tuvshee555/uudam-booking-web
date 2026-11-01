"use client";

import Image from "next/image";
import { useState } from "react";
import { BedDouble, Check, ChevronDown, ExternalLink, MapPin, X } from "lucide-react";

import { photoAlt } from "@/lib/photoCredits";
import { hotelTextSegments, type HotelLink } from "@/lib/hotelLinks";
import type { Trip } from "@/types/trip";
import { cn } from "@/lib/utils";

const MEAL_SLOTS = [
  { match: /өглөө/i, label: "Өглөө" },
  { match: /өдөр/i, label: "Өдөр" },
  { match: /орой/i, label: "Орой" },
] as const;

/**
 * The day-by-day programme as a timeline. Every day's text stays in the HTML
 * when collapsed (grid-rows animation, not conditional rendering), so the
 * whole programme is searchable and printable.
 */
export default function ItineraryTimeline({
  days,
  hotelLinks,
  photoSource,
}: {
  days: Trip["itinerary"];
  hotelLinks: HotelLink[];
  photoSource: Pick<Trip, "sourceMetadata">;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(days.slice(0, 1).map((day) => day.id)));
  const allOpen = open.size === days.length;
  // A trip whose days carry no meal data says nothing about meals; once any
  // day has them, every day shows all three so a missing meal reads as "not included".
  const showMeals = days.some((day) => day.meals.length > 0);

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(allOpen ? new Set() : new Set(days.map((day) => day.id)))}
          className="rounded-sm text-[13px] font-semibold text-foreground underline decoration-gold underline-offset-4 focus-ring"
          data-print="hide"
        >
          {allOpen ? "Бүгдийг хураах" : "Бүх өдрийг дэлгэх"}
        </button>
      </div>

      <ol className="relative mt-4">
        <span aria-hidden="true" className="absolute bottom-6 left-[1.35rem] top-6 w-px bg-border sm:left-[1.6rem]" />
        {days.map((day, index) => {
          const isOpen = open.has(day.id);
          const panelId = `day-panel-${day.id}`;
          return (
            <li key={day.id} className="relative pb-3 last:pb-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(day.id)}
                className="group flex w-full items-start gap-4 rounded-lg py-3 text-left focus-ring sm:gap-5"
              >
                <span
                  className={cn(
                    "relative z-10 flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border text-center transition-colors sm:h-[3.25rem] sm:w-[3.25rem]",
                    isOpen ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground group-hover:border-foreground/40",
                  )}
                >
                  <span className="text-[8.5px] font-semibold uppercase tracking-[0.14em] opacity-75">Өдөр</span>
                  <span className="numeral -mt-0.5 text-[1.05rem] leading-none sm:text-[1.2rem]">{day.dayNumber || index + 1}</span>
                </span>
                <span className="min-w-0 flex-1 pt-1.5 sm:pt-2.5">
                  <span className="block text-[15.5px] font-semibold leading-snug text-foreground sm:text-[17px]">{day.title}</span>
                  {day.location && (
                    <span className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-text" aria-hidden="true" />
                      <span className="truncate">{day.location}</span>
                    </span>
                  )}
                </span>
                <ChevronDown className={cn("mt-3 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 sm:mt-4", isOpen && "rotate-180")} aria-hidden="true" />
              </button>

              <div id={panelId} className={cn("grid transition-[grid-template-rows] duration-300 ease-out print:grid-rows-[1fr]", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                <div className="min-h-0 overflow-hidden" inert={!isOpen}>
                  <div className="pb-4 pl-[3.75rem] pr-1 sm:pl-[4.5rem]">
                    {day.description && <p className="whitespace-pre-line text-[15px] leading-[1.75] text-ink-soft">{day.description}</p>}
                    {day.image && (
                      <figure className="mt-4">
                        <div className="relative aspect-[16/10] w-full max-w-2xl overflow-hidden rounded-lg bg-sand">
                          <Image src={day.image} alt={photoAlt(photoSource, day.image, day.title)} fill sizes="(max-width: 640px) 90vw, 640px" quality={75} className="object-cover" />
                        </div>
                      </figure>
                    )}
                    {day.video && <video src={day.video} controls preload="metadata" playsInline className="mt-4 aspect-video w-full max-w-2xl rounded-lg bg-black print:hidden" />}
                    {(showMeals || day.accommodation) && (
                      <div className="mt-4 flex flex-col gap-3 rounded-lg bg-secondary/60 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                        {showMeals && (
                          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]" aria-label="Хоол">
                            {MEAL_SLOTS.map(({ match, label }) => {
                              const included = day.meals.some((meal) => match.test(meal));
                              return (
                                <li key={label} className={cn("flex items-center gap-1.5", included ? "font-semibold text-foreground" : "text-muted-foreground")}>
                                  {included ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <X className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />}
                                  {label}
                                  <span className="sr-only">{included ? "хоол багтсан" : "хоол багтаагүй"}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {day.accommodation && (
                          <p className="flex items-center gap-1.5 text-[13px] text-foreground">
                            <BedDouble className="h-4 w-4 shrink-0 text-gold-text" aria-hidden="true" />
                            <span>
                              {hotelTextSegments(day.accommodation, hotelLinks).map((segment, segmentIndex) => segment.url ? (
                                <a
                                  key={`${segment.url}-${segmentIndex}`}
                                  href={segment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-baseline gap-1 font-semibold underline decoration-gold underline-offset-4 focus-ring"
                                  title="Зочид буудлын хуудсыг шинэ цонхонд нээх"
                                >
                                  {segment.text}
                                  <ExternalLink className="h-3 w-3 shrink-0 self-center" aria-hidden="true" />
                                </a>
                              ) : <span key={`text-${segmentIndex}`}>{segment.text}</span>)}
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
