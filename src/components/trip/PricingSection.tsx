"use client";

import { useMemo, useState } from "react";
import { BedDouble, Check, ReceiptText, Table2, Users } from "lucide-react";

import { availability, upcomingDepartures } from "@/lib/departures";
import { departureDateKey } from "@/lib/departureDate";
import { dayTitle, ulaanbaatarDay } from "@/lib/calendar";
import { ageBandsFor, formatMnt, hasKnownTripPrice, passengerFareLabel, resolvePrices } from "@/lib/pricing";
import { datePriceOptions, hasVariablePricing } from "@/lib/tripPriceOptions";
import { priceTableBlocks } from "@/lib/tripPriceTable";
import type { HotelLink } from "@/lib/hotelLinks";
import type { Trip } from "@/types/trip";
import { cn } from "@/lib/utils";
import PriceTable from "./PriceTable";

const INITIAL_ROWS = 8;

/** Package descriptions staff wrote in package_options (never an invented default). */
function packageNotes(trip: Trip): Array<{ label: string; note: string }> {
  const options = Array.isArray(trip.sourceMetadata?.package_options) ? trip.sourceMetadata.package_options : [];
  return options.flatMap((value) => {
    const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const label = String(item.label || item.id || "").trim();
    const note = typeof item.note === "string" ? item.note.trim() : "";
    return label && note ? [{ label, note }] : [];
  });
}

/** A date's own row names and notes ("Эрт захиалгын үнэ"), shown under that date. */
function dateRowNotes(trip: Trip, departure: Parameters<typeof datePriceOptions>[1]): string[] {
  const lines = datePriceOptions(trip, departure).flatMap((option) => [option.rowLabel, option.note]).filter(Boolean);
  return [...new Set(lines)];
}

function InfoList({ icon: Icon, title, items }: { icon: typeof ReceiptText; title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
        <Icon className="h-4 w-4 text-gold-text" aria-hidden="true" />
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-[13.5px] leading-relaxed text-muted-foreground">{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What the trip costs, per person and per date, with nothing summed that
 * cannot honestly be summed: unpublished fares say "ask", dates that are
 * full say so, and every amount is labelled as the published price that
 * staff confirm when booking.
 */
export default function PricingSection({
  trip,
  activeDate,
  onSelect,
  hotelLinks = [],
}: {
  trip: Trip;
  activeDate?: string;
  onSelect: (date: string) => void;
  /** Hotel pages, so a hotel named in the price table links to it. */
  hotelLinks?: HotelLink[];
}) {
  const [now] = useState(() => Date.now());
  const [all, setAll] = useState(false);
  const departures = useMemo(() => upcomingDepartures(trip, now), [trip, now]);
  const variable = hasVariablePricing(trip);
  const blocks = useMemo(() => variable ? priceTableBlocks(trip, departures) : [], [variable, trip, departures]);
  const notes = useMemo(() => packageNotes(trip), [trip]);
  const ageBands = ageBandsFor(trip.sourceMetadata);
  const selected = departures.find((departure) => departureDateKey(departure.startDate) === activeDate)
    ?? departures.find((departure) => availability(departure).selectable)
    ?? null;
  const prices = resolvePrices(trip, selected);
  const options = selected ? datePriceOptions(trip, selected) : [];
  const optionAdults = options.flatMap((option) => [option.adult, option.adultMax]).filter((value): value is number => typeof value === "number");
  // Several hotels can each carry their own supplement; one figure would be wrong for the rest.
  const supplements = [...new Set(options.map((option) => option.singleSupplement).filter((value): value is number => typeof value === "number" && value > 0))];
  const supplementValues = supplements.length ? supplements
    : typeof trip.singleSupplement === "number" && trip.singleSupplement > 0 ? [trip.singleSupplement] : [];

  const fares = variable && optionAdults.length
    ? [{ label: "Том хүн", band: ageBands.adult, value: optionAdults.length > 1 ? `${formatMnt(Math.min(...optionAdults))}–${formatMnt(Math.max(...optionAdults))}` : formatMnt(optionAdults[0]) }]
    : [
        { label: "Том хүн", band: ageBands.adult, value: hasKnownTripPrice(prices.adult) ? formatMnt(prices.adult) : "Үнэ лавлах" },
        { label: "Хүүхэд", band: ageBands.child, value: passengerFareLabel(trip.sourceMetadata, "child", prices.child) },
        { label: "Нярай", band: ageBands.infant, value: passengerFareLabel(trip.sourceMetadata, "infant", prices.infant) },
      ];
  if (supplementValues.length) {
    fares.push({
      label: "Ганц хүний өрөө",
      band: supplementValues.length > 1 ? "нэмэгдэл · буудлаас хамаарна" : "нэмэгдэл",
      value: supplementValues.length > 1
        ? `+${formatMnt(Math.min(...supplementValues))}–${formatMnt(Math.max(...supplementValues))}`
        : `+${formatMnt(supplementValues[0])}`,
    });
  }

  const shown = all ? departures : departures.slice(0, INITIAL_ROWS);

  return (
    <div>
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-foreground">Нэг хүний үнэ</h3>
          <p className="text-[12.5px] text-muted-foreground">
            {selected ? `${dayTitle(departureDateKey(selected.startDate)).split(",")[0]}-ны хөдлөлт` : "Нийтэлсэн үндсэн үнэ"}
          </p>
        </div>
        <dl className={cn("mt-4 grid gap-px overflow-hidden rounded-lg border border-border bg-border", fares.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : fares.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {fares.map((fare) => (
            <div key={fare.label} className="bg-background p-4">
              <dt className="text-[12px] text-muted-foreground">
                <span className="font-semibold text-foreground">{fare.label}</span>
                {fare.band && <span className="block">{fare.band}</span>}
              </dt>
              <dd className="mt-2 text-[16px] font-bold tabular-nums text-foreground sm:text-[17px]">{fare.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {variable
            ? "Энэ аяллын үнэ зочид буудал, багцаас хамаарч өөр. Сонголтоо хийхэд ажилтан эцсийн үнийг баталгаажуулна."
            : "Тухайн огнооны нийтэлсэн үнэ. Эцсийн дүнг захиалга баталгаажих үед ажилтан тодруулна."}
        </p>
      </div>

      {blocks.length > 0 && (
        <div className="mt-6">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <Table2 className="h-4 w-4 text-gold-text" aria-hidden="true" />
            {blocks.some((block) => block.showHotel) ? "Буудал, багцаар үнэ" : "Сонголтоор үнэ"}
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            Огноо бүрийн нэг хүний үнэ. Ижил үнэтэй огноонуудыг нэг хүснэгтэд нэгтгэв.
          </p>
          <PriceTable
            blocks={blocks}
            activeDay={selected ? departureDateKey(selected.startDate) : undefined}
            currentYear={Number(ulaanbaatarDay(now).slice(0, 4))}
            hotelLinks={hotelLinks}
            adultBand={ageBands.adult}
          />
          {notes.length > 0 && blocks.some((block) => block.showPackage) && (
            <dl className="mt-4 space-y-2 text-[13px] leading-relaxed">
              {notes.map((entry) => (
                <div key={entry.label}>
                  <dt className="inline font-semibold text-foreground">{entry.label}: </dt>
                  <dd className="inline text-muted-foreground">{entry.note}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {departures.length > 0 ? (
        <div className="mt-6">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <Users className="h-4 w-4 text-gold-text" aria-hidden="true" />
            Хөдлөх огноонууд
            <span className="text-[13px] font-normal text-muted-foreground">({departures.length})</span>
          </h3>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {shown.map((departure) => {
              const seats = availability(departure);
              const key = departureDateKey(departure.startDate);
              // A trip priced by hotel or package: the cheapest option on this date, as a "from" price.
              const optionPrices = variable
                ? datePriceOptions(trip, departure).map((option) => option.adult).filter((value): value is number => hasKnownTripPrice(value))
                : [];
              const price = optionPrices.length ? Math.min(...optionPrices) : departure.price ?? trip.price;
              const active = selected?.id === departure.id;
              // A variable-priced trip shows its notes in the table above; a plain one shows them here.
              const rowNotes = variable ? [] : dateRowNotes(trip, departure);
              return (
                <li key={departure.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5", !seats.selectable && "opacity-60")}>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[14.5px] font-semibold text-foreground", !seats.selectable && "line-through")}>
                      {dayTitle(key)}
                      {departure.endDate && <span className="font-normal text-muted-foreground"> — {dayTitle(departureDateKey(departure.endDate)).split(",")[0]}</span>}
                    </p>
                    <p className={cn("mt-0.5 flex items-center gap-1.5 text-[12.5px] font-medium", !seats.selectable ? "text-destructive" : seats.tone === "tight" ? "text-warning" : "text-success")}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", !seats.selectable ? "bg-destructive" : seats.tone === "tight" ? "bg-warning" : "bg-success")} aria-hidden="true" />
                      {seats.label}
                    </p>
                    {rowNotes.map((line) => (
                      <p key={line} className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-muted-foreground">{line}</p>
                    ))}
                  </div>
                  <p className="text-right">
                    <span className="block text-[15px] font-bold tabular-nums text-foreground">{hasKnownTripPrice(price) ? `${formatMnt(price)}${variable ? "-с" : ""}` : "Үнэ лавлах"}</span>
                    {hasKnownTripPrice(price) && <span className="text-[11.5px] text-muted-foreground">{variable ? "том хүн · сонголтоос хамаарна" : "том хүн"}</span>}
                  </p>
                  {seats.selectable ? (
                    <button
                      type="button"
                      onClick={() => onSelect(key)}
                      aria-pressed={active}
                      className={cn(
                        "inline-flex h-10 min-w-[6.5rem] items-center justify-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold transition-colors focus-ring",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-foreground/40",
                      )}
                    >
                      {active && <Check className="h-4 w-4" aria-hidden="true" />}
                      {active ? "Сонгосон" : "Сонгох"}
                    </button>
                  ) : (
                    <span className="inline-flex h-10 min-w-[6.5rem] items-center justify-center text-[12.5px] text-muted-foreground">Захиалах боломжгүй</span>
                  )}
                </li>
              );
            })}
          </ul>
          {departures.length > INITIAL_ROWS && (
            <button type="button" onClick={() => setAll((value) => !value)} className="mt-4 rounded-sm text-[13px] font-semibold text-foreground underline decoration-gold underline-offset-4 focus-ring">
              {all ? "Цөөнийг харуулах" : `Бүх огноог харах (${departures.length})`}
            </button>
          )}
        </div>
      ) : (
        <p className="mt-6 rounded-lg bg-secondary/70 p-4 text-[14px] leading-relaxed text-muted-foreground">
          Одоогоор товлосон хөдлөлт алга. Хүссэн огноогоо үлдээвэл ажилтан боломжтой огноог тодруулж өгнө.
        </p>
      )}

      {(trip.extraFees.length > 0 || trip.roomPrices.length > 0 || trip.childPriceNotes.length > 0) && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {trip.extraFees.length > 0 && <InfoList icon={ReceiptText} title="Нэмэлт төлбөр" items={trip.extraFees} />}
          {trip.roomPrices.length > 0 && <InfoList icon={BedDouble} title="Өрөөний үнэ" items={trip.roomPrices} />}
          {trip.childPriceNotes.length > 0 && <InfoList icon={Users} title="Үнэ, насны ангилал" items={trip.childPriceNotes} />}
        </div>
      )}
    </div>
  );
}
