"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Info, Plane, Shirt, Umbrella } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  roundTemp,
  shortDate,
  weatherIcon,
  weatherLabel,
  weekdayShort,
  type TripWeatherDay,
  type TripWeatherReport,
} from "@/lib/weather";

/** Fired by the booking/enquiry date pickers so the weather follows the chosen departure. */
export const DEPARTURE_SELECT_EVENT = "uudam:departure-select";

export function announceDepartureSelect(ymd: string) {
  window.dispatchEvent(new CustomEvent<string>(DEPARTURE_SELECT_EVENT, { detail: ymd }));
}

/** The trip's weather for one departure — shared by the section and the section nav. */
export function useTripWeather(tripKey: string | undefined, date?: string | null) {
  return useQuery<TripWeatherReport>({
    queryKey: ["trip-weather", tripKey, date ?? null],
    queryFn: async () =>
      (await api.get<TripWeatherReport>("/weather", { params: { trip: tripKey, ...(date ? { date } : {}) } })).data,
    enabled: Boolean(tripKey),
    staleTime: 10 * 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}

/** Follow the departure picked in the booking panel. */
export function useAnnouncedDeparture(initial?: string | null) {
  const [date, setDate] = useState<string | null>(initial ?? null);
  useEffect(() => {
    const onSelect = (event: Event) => {
      const ymd = (event as CustomEvent<string>).detail;
      if (typeof ymd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) setDate(ymd);
    };
    window.addEventListener(DEPARTURE_SELECT_EVENT, onSelect);
    return () => window.removeEventListener(DEPARTURE_SELECT_EVENT, onSelect);
  }, []);
  return [date, setDate] as const;
}

function WeatherIcon({ code, className }: { code: string; className?: string }) {
  return (
    // Animated SVGs (SMIL); an <img> keeps each icon's internal ids isolated.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={weatherIcon(code)} alt={weatherLabel(code)} className={cn("shrink-0 select-none", className)} draggable={false} />
  );
}

function DayTile({ day, placeName, placeChanged }: { day: TripWeatherDay; placeName: string | null; placeChanged: boolean }) {
  const typical = day.source === "typical";
  const hasWeather = day.symbol && day.hi !== null && day.lo !== null;

  return (
    <li
      data-date={day.date}
      className={cn(
        "flex min-w-[112px] snap-start flex-col rounded-xl border p-3 text-center sm:min-w-0",
        typical ? "border-dashed border-border bg-secondary/30" : "border-border bg-card shadow-sm",
      )}
      title={hasWeather ? weatherLabel(day.symbol!) : undefined}
    >
      <span className="text-[11px] font-bold uppercase tracking-wide text-primary">{day.day}-р өдөр</span>
      <span className="text-xs text-muted-foreground">
        {weekdayShort(day.date)} · {shortDate(day.date)}
      </span>
      <span
        className={cn(
          "mt-1 truncate text-xs font-semibold",
          placeChanged ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {placeName ?? "Замд"}
      </span>

      {hasWeather ? (
        <>
          <WeatherIcon code={day.symbol!} className={cn("mx-auto my-1 h-14 w-14", typical && "opacity-80")} />
          <span className="text-sm">
            <span className="font-bold tabular-nums">{roundTemp(day.hi!)}°</span>
            <span className="text-muted-foreground"> / </span>
            <span className="tabular-nums text-muted-foreground">{roundTemp(day.lo!)}°</span>
          </span>
          <span
            className={cn(
              "mt-0.5 flex items-center justify-center gap-0.5 text-[11px]",
              (typical ? (day.rainChance ?? 0) >= 30 : (day.precipMm ?? 0) >= 1)
                ? "text-sky-600 dark:text-sky-400"
                : "text-muted-foreground/70",
            )}
          >
            <Umbrella className="h-3 w-3" />
            {typical ? `${day.rainChance ?? 0}%` : `${Math.round(day.precipMm ?? 0)} мм`}
          </span>
          <span
            className={cn(
              "mt-2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold",
              typical ? "bg-muted text-muted-foreground" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
            )}
          >
            {typical ? "Ердийн" : "Таамаг"}
          </span>
        </>
      ) : (
        <span className="my-3 flex flex-col items-center gap-1 text-xs text-muted-foreground">
          <Plane className="h-6 w-6" />
          Аялалд гарах / буцах
        </span>
      )}
    </li>
  );
}

/**
 * Weather for the traveller's own trip days, in the city they are in each
 * day: the real forecast where one exists (≤ ~9 days ahead), otherwise that
 * date's long-term normal — always labelled, never passed off as a forecast.
 */
export default function TripWeather({
  report,
  onSelectDeparture,
}: {
  report: TripWeatherReport;
  onSelectDeparture: (ymd: string) => void;
}) {
  const stripRef = useRef<HTMLOListElement>(null);
  const days = report.days;
  const anyTypical = days.some((d) => d.source === "typical");
  const anyForecast = days.some((d) => d.source === "forecast");
  const route = useMemo(() => {
    const seen: number[] = [];
    for (const d of days) if (d.place !== null && !seen.includes(d.place)) seen.push(d.place);
    return seen.map((i) => report.places[i]?.name).filter(Boolean).join(" → ");
  }, [days, report.places]);

  // New departure → start the strip from day 1 again.
  useEffect(() => {
    if (stripRef.current) stripRef.current.scrollLeft = 0;
  }, [report.departure]);

  return (
    <div>
      {report.departures.length > 1 && (
        <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1" role="tablist" aria-label="Гарах огноо">
          {report.departures.slice(0, 12).map((date) => (
            <button
              key={date}
              type="button"
              role="tab"
              aria-selected={date === report.departure}
              onClick={() => onSelectDeparture(date)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors",
                date === report.departure
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {shortDate(date)}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm">
        <span className="font-semibold">
          {report.departure
            ? `${shortDate(days[0].date)} – ${shortDate(days[days.length - 1].date)}`
            : "Гарах огноо тодорхойгүй — ойрын өдрүүд"}
        </span>
        {route && <span className="text-muted-foreground"> · {route}</span>}
      </p>

      <ol
        ref={stripRef}
        className="no-scrollbar -mx-1 mt-3 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))] sm:overflow-visible"
      >
        {days.map((day, index) => {
          const name = day.place !== null ? (report.places[day.place]?.name ?? null) : null;
          return (
            <DayTile
              key={day.date}
              day={day}
              placeName={name}
              placeChanged={index === 0 || day.place !== days[index - 1].place}
            />
          );
        })}
      </ol>

      {anyTypical && (
        <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-semibold text-foreground">“Таамаг”</span> — тухайн өдрийн бодит урьдчилсан мэдээ;{" "}
            <span className="font-semibold text-foreground">“Ердийн”</span> — тухайн өдрүүдийн олон жилийн дундаж.
            {report.forecastFrom
              ? ` Бодит урьдчилсан мэдээ ${shortDate(report.forecastFrom)}-наас эндээ автоматаар гарна.`
              : anyForecast
                ? " Урьдчилсан мэдээ ~9 хоногийн цаашхи өдрүүдэд хүрдэггүй."
                : ""}
          </span>
        </p>
      )}

      {report.packing && (
        <p className="mt-3 flex gap-2 rounded-xl bg-secondary/50 p-3 text-sm">
          <Shirt className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="font-semibold">Авч явах: </span>
            {report.packing}.
          </span>
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Урьдчилсан мэдээ:{" "}
        <a href="https://www.yr.no" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
          MET Norway (yr.no)
        </a>
        , CC BY 4.0 · Олон жилийн дундаж:{" "}
        <a href="https://power.larc.nasa.gov" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
          NASA POWER
        </a>
      </p>
    </div>
  );
}
