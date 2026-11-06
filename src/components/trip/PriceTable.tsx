"use client";

import { useState } from "react";
import { BedDouble, ChevronDown, ExternalLink } from "lucide-react";

import { formatMnt } from "@/lib/pricing";
import { formatAdultOption, formatPassengerOption, type DatePriceOption } from "@/lib/tripPriceOptions";
import { formatHotelName, hotelTextSegments, type HotelLink } from "@/lib/hotelLinks";
import { blockForDay, formatDayList, type PriceTableBlock } from "@/lib/tripPriceTable";
import { cn } from "@/lib/utils";

/*
 * One markup, two layouts. A real table where the column has room (md–lg with
 * no sidebar, and xl+), and one card per hotel × package where it does not
 * (phones, and lg–xl where the booking sidebar narrows the main column).
 * Tailwind needs every class spelled out, so the card-mode variants repeat.
 */
const TABLE = "w-full border-collapse text-left text-[13px] max-md:block lg:max-xl:block";
const THEAD = "max-md:hidden lg:max-xl:hidden";
const TBODY = "max-md:grid max-md:gap-3 sm:max-md:grid-cols-2 lg:max-xl:grid lg:max-xl:grid-cols-2 lg:max-xl:gap-3";
const ROW = "align-top md:max-lg:border-b md:max-lg:border-border md:max-lg:last:border-b-0 xl:border-b xl:border-border xl:last:border-b-0 max-md:block max-md:rounded-lg max-md:border max-md:border-border max-md:bg-background max-md:p-3.5 lg:max-xl:block lg:max-xl:rounded-lg lg:max-xl:border lg:max-xl:border-border lg:max-xl:bg-background lg:max-xl:p-3.5";
const NAME_CELL = "py-3 pr-3 font-semibold text-foreground max-md:block max-md:p-0 max-md:pb-2 lg:max-xl:block lg:max-xl:p-0 lg:max-xl:pb-2";
const VALUE_CELL = "py-3 pl-3 text-right tabular-nums text-foreground max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-3 max-md:p-0 max-md:py-1 max-md:text-left lg:max-xl:flex lg:max-xl:items-baseline lg:max-xl:justify-between lg:max-xl:gap-3 lg:max-xl:p-0 lg:max-xl:py-1 lg:max-xl:text-left";
const EMPTY_CELL = "max-md:hidden lg:max-xl:hidden";
const CELL_LABEL = "text-[12.5px] font-normal text-muted-foreground md:max-lg:hidden xl:hidden";
const HEAD_CELL = "py-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

function HotelName({ name, links }: { name: string; links: HotelLink[] }) {
  return (
    <>
      {hotelTextSegments(formatHotelName(name), links).map((segment, index) => segment.url ? (
        <a
          key={`${segment.url}-${index}`}
          href={segment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-baseline gap-1 underline decoration-gold underline-offset-4 focus-ring"
          title="Зочид буудлын хуудсыг шинэ цонхонд нээх"
        >
          {segment.text}
          <ExternalLink className="h-3 w-3 shrink-0 self-center" aria-hidden="true" />
        </a>
      ) : <span key={`text-${index}`}>{segment.text}</span>)}
    </>
  );
}

function RowName({ row, block, links }: { row: DatePriceOption; block: PriceTableBlock; links: HotelLink[] }) {
  const title = block.showHotel ? row.hotel : block.showPackage ? row.packageLabel : row.rowLabel;
  return (
    <>
      <span className="flex items-start gap-2">
        {block.showHotel && <BedDouble className="mt-0.5 h-4 w-4 shrink-0 text-gold-text" aria-hidden="true" />}
        <span className="min-w-0">
          {block.showHotel ? <HotelName name={row.hotel || "Буудал заагаагүй"} links={links} /> : title || "Үнэ"}
          {!row.available && <span className="ml-2 inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">Дүүрсэн</span>}
        </span>
      </span>
      {row.rowLabel && row.rowLabel !== title && <span className="mt-1 block text-[12px] font-normal text-muted-foreground">{row.rowLabel}</span>}
      {row.note && <span className="mt-1 block whitespace-pre-line text-[12px] font-normal leading-relaxed text-muted-foreground">{row.note}</span>}
    </>
  );
}

/**
 * The trip's prices for every bookable date, hotel and package, in the main
 * column. A hotel × package row shows its adult fare, each child and infant
 * band the source prices, the single-room supplement and the row's own note.
 * Dates with identical prices share one table; the selected date's opens.
 */
export default function PriceTable({
  blocks,
  activeDay,
  currentYear,
  hotelLinks,
  adultBand,
}: {
  blocks: PriceTableBlock[];
  activeDay?: string;
  currentYear: number;
  hotelLinks: HotelLink[];
  adultBand: string;
}) {
  const activeKey = blockForDay(blocks, activeDay)?.key ?? blocks[0]?.key;
  const [open, setOpen] = useState<Set<string>>(() => new Set(activeKey ? [activeKey] : []));
  const [shownActive, setShownActive] = useState(activeKey);
  // A date chosen elsewhere on the page (list, calendar, weather) opens its table.
  if (activeKey !== shownActive) {
    setShownActive(activeKey);
    if (activeKey && !open.has(activeKey)) setOpen(new Set([...open, activeKey]));
  }

  if (!blocks.length) return null;

  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <ul className="mt-3 divide-y divide-border border-y border-border">
      {blocks.map((block) => {
        const isOpen = open.has(block.key);
        const isActive = block.key === blockForDay(blocks, activeDay)?.key;
        const panelId = `price-block-${block.key}`;
        const dates = formatDayList(block.days, currentYear);
        return (
          <li key={block.key}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(block.key)}
              className="flex w-full items-center gap-3 rounded-sm py-3.5 text-left focus-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold leading-snug text-foreground">{dates}</span>
                <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                  {block.days.length > 1 ? `${block.days.length} огноо · ` : ""}{block.rows.length} сонголт
                  {isActive && <span className="font-semibold text-foreground"> · Сонгосон огноо</span>}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[14.5px] font-bold tabular-nums text-foreground">{block.fromAdult != null ? `${formatMnt(block.fromAdult)}-с` : "Үнэ лавлах"}</span>
                <span className="text-[11.5px] text-muted-foreground">том хүн</span>
              </span>
              <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} aria-hidden="true" />
            </button>

            <div id={panelId} className={cn("grid transition-[grid-template-rows] duration-300 ease-out print:grid-rows-[1fr]", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="min-h-0 overflow-hidden" inert={!isOpen}>
                <table className={cn(TABLE, "mb-4")}>
                  <caption className="sr-only">{dates} — нэг хүний үнэ</caption>
                  <thead className={THEAD}>
                    <tr className="border-b border-border">
                      <th scope="col" className={cn(HEAD_CELL, "pr-3")}>{block.showHotel ? "Буудал" : block.showPackage ? "Багц" : "Үнэ"}</th>
                      {block.showHotel && block.showPackage && <th scope="col" className={cn(HEAD_CELL, "px-3")}>Багц</th>}
                      <th scope="col" className={cn(HEAD_CELL, "pl-3 text-right")}>
                        Том хүн
                        {adultBand && <span className="block font-normal normal-case tracking-normal">{adultBand}</span>}
                      </th>
                      {block.bands.map((band) => (
                        <th key={band.key} scope="col" className={cn(HEAD_CELL, "pl-3 text-right normal-case tracking-normal")}>{band.label}</th>
                      ))}
                      {block.showSingle && <th scope="col" className={cn(HEAD_CELL, "pl-3 text-right")}>Ганц өрөө</th>}
                    </tr>
                  </thead>
                  <tbody className={TBODY}>
                    {block.rows.map((row) => (
                      <tr key={row.key} className={cn(ROW, !row.available && "opacity-60")}>
                        <th scope="row" className={NAME_CELL}>
                          <RowName row={row} block={block} links={hotelLinks} />
                        </th>
                        {block.showHotel && block.showPackage && (
                          <td className={cn(VALUE_CELL, "md:max-lg:px-3 md:max-lg:text-left xl:px-3 xl:text-left")}>
                            <span className={CELL_LABEL}>Багц</span>
                            <span className="font-medium">{row.packageLabel || "—"}</span>
                          </td>
                        )}
                        <td className={VALUE_CELL}>
                          <span className={CELL_LABEL}>Том хүн{adultBand ? ` · ${adultBand}` : ""}</span>
                          <span className="font-bold">{formatAdultOption(row)}</span>
                        </td>
                        {block.bands.map((band) => {
                          // By key, never by label: bands that share a label (another height, a repeat) keep their own fares.
                          const fare = row.passengers.find((passenger) => passenger.key === band.key);
                          return fare ? (
                            <td key={band.key} className={VALUE_CELL}>
                              <span className={CELL_LABEL}>{band.label}</span>
                              <span>{formatPassengerOption(fare)}</span>
                            </td>
                          ) : (
                            <td key={band.key} className={cn(VALUE_CELL, EMPTY_CELL, "text-muted-foreground")}>
                              <span aria-hidden="true">—</span>
                              <span className="sr-only">Энэ сонголтод үнэ заагаагүй</span>
                            </td>
                          );
                        })}
                        {block.showSingle && (row.singleSupplement != null && row.singleSupplement > 0 ? (
                          <td className={VALUE_CELL}>
                            <span className={CELL_LABEL}>Ганц хүний өрөө</span>
                            <span>+{formatMnt(row.singleSupplement)}</span>
                          </td>
                        ) : (
                          <td className={cn(VALUE_CELL, EMPTY_CELL, "text-muted-foreground")}>
                            <span aria-hidden="true">—</span>
                            <span className="sr-only">Ганц хүний өрөөний нэмэгдэл заагаагүй</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
