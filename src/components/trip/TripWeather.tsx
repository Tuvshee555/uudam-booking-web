"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Droplets, Shirt, Umbrella, Wind } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  climateFeel,
  climateSymbol,
  monthName,
  packingTip,
  roundTemp,
  shortDate,
  weatherIcon,
  weatherLabel,
  weatherMood,
  weekdayShort,
  type ClimateMonth,
  type PlaceWeatherReport,
  type TripWeatherReport,
} from "@/lib/weather";

/** The trip's weather report — shared by the section and the section nav. */
export function useTripWeather(tripKey: string | undefined) {
  return useQuery<TripWeatherReport>({
    queryKey: ["trip-weather", tripKey],
    queryFn: async () => (await api.get<TripWeatherReport>("/weather", { params: { trip: tripKey } })).data,
    enabled: Boolean(tripKey),
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

/** Background per sky — the broadcast "mood" of the current conditions. */
const MOOD_SURFACE: Record<ReturnType<typeof weatherMood>, string> = {
  sun: "bg-gradient-to-br from-sky-400 via-sky-500 to-blue-700 text-white",
  cloud: "bg-gradient-to-br from-slate-400 via-slate-500 to-slate-700 text-white",
  rain: "bg-gradient-to-br from-slate-600 via-slate-700 to-[#0b2546] text-white",
  snow: "bg-gradient-to-br from-sky-100 via-slate-200 to-slate-400 text-slate-900",
  night: "bg-gradient-to-br from-[#1b1f4b] via-[#0f2a4d] to-navy-deep text-white",
};

function WeatherIcon({ code, size, className }: { code: string; size: number; className?: string }) {
  return (
    // Animated SVGs (SMIL) — an <img> keeps each icon's internal ids isolated
    // and needs no optimisation; they are ~2 KB each.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={weatherIcon(code)}
      alt={weatherLabel(code)}
      width={size}
      height={size}
      className={cn("shrink-0 select-none", className)}
      draggable={false}
    />
  );
}

function Temp({ value, className }: { value: number; className?: string }) {
  return <span className={cn("tabular-nums", className)}>{roundTemp(value)}°</span>;
}

/** Broadcast temperature scale: deep blue (frost) → teal → green (mild) → yellow → orange → red (hot). */
const TEMP_STOPS: [number, number][] = [
  [-20, 232], [0, 205], [10, 175], [16, 130], [22, 52], [28, 32], [35, 6],
];

function tempColor(celsius: number): string {
  const t = Math.max(TEMP_STOPS[0][0], Math.min(TEMP_STOPS[TEMP_STOPS.length - 1][0], celsius));
  let hue = TEMP_STOPS[TEMP_STOPS.length - 1][1];
  for (let i = 1; i < TEMP_STOPS.length; i += 1) {
    const [t1, h1] = TEMP_STOPS[i];
    const [t0, h0] = TEMP_STOPS[i - 1];
    if (t <= t1) {
      hue = h0 + ((t - t0) / (t1 - t0)) * (h1 - h0);
      break;
    }
  }
  return `hsl(${Math.round(hue)} 82% 52%)`;
}

function localClock(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date());
  } catch {
    return "";
  }
}

function NowPanel({ report }: { report: PlaceWeatherReport }) {
  const current = report.current;
  const today = report.daily[0];
  // Client-only (the report is fetched after mount), so reading the clock
  // in the initialiser can't cause a hydration mismatch. Keyed per place.
  const [clock, setClock] = useState(() => localClock(report.place.timezone));
  useEffect(() => {
    const timer = window.setInterval(() => setClock(localClock(report.place.timezone)), 30_000);
    return () => window.clearInterval(timer);
  }, [report.place.timezone]);

  if (!current) return null;
  const mood = weatherMood(current.symbol);
  const dark = mood !== "snow";

  return (
    <div className={cn("relative overflow-hidden rounded-2xl p-5 sm:p-6", MOOD_SURFACE[mood])}>
      {/* soft light bloom, like a studio weather wall */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/20 blur-3xl"
      />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className={cn("text-xs font-semibold uppercase tracking-[0.14em]", dark ? "text-white/75" : "text-slate-600")}>
            Одоо
            {clock && (
              <>
                {" · "}
                <span className="hidden sm:inline">орон нутгийн цаг </span>
                {clock}
              </>
            )}
          </p>
          <h3 className="mt-1 truncate text-2xl font-extrabold sm:text-3xl">{report.place.name}</h3>
          {report.place.country && (
            <p className={cn("text-sm", dark ? "text-white/80" : "text-slate-600")}>{report.place.country}</p>
          )}
          <p className="mt-3 text-base font-semibold sm:text-lg">{weatherLabel(current.symbol)}</p>
        </div>

        <div className="flex shrink-0 items-center">
          <WeatherIcon code={current.symbol} size={112} className="-my-3 h-24 w-24 drop-shadow-xl sm:h-32 sm:w-32" />
          <div className="flex items-start leading-none">
            <Temp value={current.temp} className="text-6xl font-black tracking-tighter sm:text-7xl" />
            <span className="mt-1.5 text-xl font-bold opacity-80 sm:text-2xl">C</span>
          </div>
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-2 text-sm">
        {today && (
          <span className={cn("rounded-full px-3 py-1.5 font-medium backdrop-blur", dark ? "bg-white/15" : "bg-white/60")}>
            Өнөөдөр <Temp value={today.hi} className="font-bold" /> / <Temp value={today.lo} />
          </span>
        )}
        {current.humidity !== null && (
          <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium backdrop-blur", dark ? "bg-white/15" : "bg-white/60")}>
            <Droplets className="h-3.5 w-3.5" /> Чийгшил {Math.round(current.humidity)}%
          </span>
        )}
        {current.windMs !== null && (
          <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium backdrop-blur", dark ? "bg-white/15" : "bg-white/60")}>
            <Wind className="h-3.5 w-3.5" /> Салхи {Math.round(current.windMs)} м/с
          </span>
        )}
      </div>
    </div>
  );
}

function ForecastStrip({ report, tripDays }: { report: PlaceWeatherReport; tripDays: Set<string> }) {
  const days = report.daily.slice(0, 8);
  const stripRef = useRef<HTMLOListElement>(null);
  const firstTripDay = days.find((d) => tripDays.has(d.date))?.date;

  // On a phone the strip scrolls sideways — bring the traveller's own days
  // into view instead of leaving them off-screen to the right.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !firstTripDay || strip.scrollWidth <= strip.clientWidth) return;
    const tile = strip.querySelector<HTMLElement>(`[data-date="${firstTripDay}"]`);
    // The <ol> is `relative`, so offsetLeft is measured from the strip itself.
    if (tile) strip.scrollLeft = Math.max(0, tile.offsetLeft - 16);
  }, [firstTripDay]);

  if (!days.length) return null;
  const hasTripDay = Boolean(firstTripDay);

  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold">Ойрын {days.length} хоног</h3>
        {hasTripDay && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-gold" /> таны аяллын өдрүүд
          </span>
        )}
      </div>
      <ol
        ref={stripRef}
        className="no-scrollbar relative -mx-1 mt-3 flex snap-x gap-2 overflow-x-auto px-1 pb-1 pt-2 sm:grid sm:grid-cols-8 sm:overflow-visible"
      >
        {days.map((day, index) => {
          const tripDay = tripDays.has(day.date);
          return (
            <li
              key={day.date}
              data-date={day.date}
              className={cn(
                "relative flex min-w-[76px] snap-start flex-col items-center rounded-xl border px-1.5 py-2.5 text-center transition-colors",
                tripDay ? "border-gold bg-gold/10 ring-1 ring-gold" : "border-border bg-card",
              )}
              title={weatherLabel(day.symbol)}
            >
              {tripDay && (
                <span className="absolute -top-2 rounded-full bg-gold px-1.5 text-[10px] font-bold text-navy-deep">
                  Аялал
                </span>
              )}
              <span className="text-xs font-semibold">{index === 0 ? "Өнөөдөр" : weekdayShort(day.date)}</span>
              <span className="text-[11px] text-muted-foreground">{shortDate(day.date)}</span>
              <WeatherIcon code={day.symbol} size={48} className="my-1 h-12 w-12" />
              <span className="text-sm">
                <Temp value={day.hi} className="font-bold" />
                <span className="text-muted-foreground"> / </span>
                <Temp value={day.lo} className="text-muted-foreground" />
              </span>
              <span
                className={cn(
                  "mt-0.5 flex items-center gap-0.5 text-[11px]",
                  day.precipMm >= 1 ? "text-sky-600 dark:text-sky-400" : "invisible",
                )}
              >
                <Umbrella className="h-3 w-3" />
                {Math.round(day.precipMm)} мм
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MonthChart({
  months,
  selected,
  highlighted,
  onSelect,
}: {
  months: ClimateMonth[];
  selected: number;
  highlighted: Set<number>;
  onSelect: (index: number) => void;
}) {
  const min = Math.min(...months.map((m) => m.lo));
  const max = Math.max(...months.map((m) => m.hi));
  const span = Math.max(1, max - min);
  const pct = (value: number) => ((value - min) / span) * 100;

  return (
    <div className="mt-4">
      <div className="grid grid-cols-12 gap-1 sm:gap-1.5">
        {months.map((month, index) => {
          const active = index === selected;
          const travel = highlighted.has(index);
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelect(index)}
              aria-pressed={active}
              aria-label={`${monthName(index)}: өдөртөө ${roundTemp(month.hi)}°, шөнөдөө ${roundTemp(month.lo)}°`}
              className={cn(
                "group flex flex-col items-center rounded-lg px-0.5 pb-1 pt-1.5 transition-colors",
                active ? "bg-secondary" : "hover:bg-secondary/60",
              )}
            >
              <span className="text-[10px] font-bold tabular-nums sm:text-xs">{roundTemp(month.hi)}°</span>
              <span className="relative my-1 block h-24 w-2.5 rounded-full bg-muted sm:w-3">
                <span
                  className="absolute inset-x-0 rounded-full"
                  style={{
                    bottom: `${pct(month.lo)}%`,
                    top: `${100 - pct(month.hi)}%`,
                    background: `linear-gradient(to top, ${tempColor(month.lo)}, ${tempColor(month.hi)})`,
                  }}
                />
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground sm:text-xs">{roundTemp(month.lo)}°</span>
              <span
                className={cn(
                  "mt-1 rounded-full px-1 text-[10px] font-semibold sm:text-[11px]",
                  travel ? "bg-gold text-navy-deep" : active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>Сар бүрийн өдрийн дээд / шөнийн доод дундаж хэм</span>
        {highlighted.size > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-gold" /> аялал гарах сар
          </span>
        )}
      </p>
    </div>
  );
}

function ClimatePanel({ report, departures }: { report: PlaceWeatherReport; departures: string[] }) {
  const travelMonths = useMemo(
    () => [...new Set(departures.map((date) => Number(date.slice(5, 7)) - 1))],
    [departures],
  );
  const [selected, setSelected] = useState(() => travelMonths[0] ?? new Date().getMonth());

  const climate = report.climate;
  if (!climate) return null;
  const month = climate.months[selected];
  const rain = Math.round(month.rainDays);

  return (
    <div className="mt-6 rounded-2xl border border-border bg-secondary/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <CalendarDays className="h-4 w-4 text-primary" />
          {travelMonths.includes(selected) ? "Аялах үеийн цаг агаар" : "Сарын дундаж цаг агаар"}
        </h3>
        <span className="text-[11px] text-muted-foreground">Олон жилийн дундаж · {climate.period}</span>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <WeatherIcon code={climateSymbol(month)} size={80} className="h-20 w-20" />
        <div className="min-w-0">
          <p className="text-lg font-extrabold">
            {monthName(selected)}
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 align-middle text-xs font-semibold text-primary">
              {climateFeel(month)}
            </span>
          </p>
          <p className="mt-1 text-sm">
            Өдөртөө <Temp value={month.hi} className="text-base font-bold" />C · Шөнөдөө{" "}
            <Temp value={month.lo} className="text-base font-bold" />C
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Umbrella className="h-3.5 w-3.5" />
            {rain <= 1 ? "Бороо бараг ордоггүй" : `Сардаа ~${rain} өдөр бороо орно`}
          </p>
        </div>
      </div>

      <p className="mt-4 flex gap-2 rounded-xl bg-card p-3 text-sm">
        <Shirt className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          <span className="font-semibold">Авч явах: </span>
          {packingTip(month)}.
        </span>
      </p>

      <MonthChart months={climate.months} selected={selected} highlighted={new Set(travelMonths)} onSelect={setSelected} />
    </div>
  );
}

/**
 * Trip-page weather: live conditions + 9-day forecast per stop (MET Norway),
 * and the travel month's normals (NASA POWER) for trips beyond the forecast.
 * Renders nothing until there is real data — no placeholder weather, ever.
 */
export default function TripWeather({ report, durationDays }: { report: TripWeatherReport; durationDays: number }) {
  const [active, setActive] = useState(0);
  const places = report.places.filter((p) => p.current || p.daily.length || p.climate);
  const current = places[Math.min(active, places.length - 1)];
  const nextDeparture = report.departures[0];
  // Every calendar day of the next departure, so the strip marks the whole
  // trip, not just the day it leaves.
  const tripDays = useMemo(() => {
    const days = new Set<string>();
    if (!nextDeparture) return days;
    const start = Date.parse(`${nextDeparture}T00:00:00Z`);
    for (let i = 0; i < Math.max(1, durationDays); i += 1) {
      days.add(new Date(start + i * 86_400_000).toISOString().slice(0, 10));
    }
    return days;
  }, [nextDeparture, durationDays]);
  if (!current) return null;

  const forecastReachesTrip = nextDeparture ? current.daily.some((d) => d.date >= nextDeparture) : true;

  return (
    <div>
      {places.length > 1 && (
        <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1" role="tablist" aria-label="Аяллын хотууд">
          {places.map((place, index) => (
            <button
              key={`${place.place.name}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === active}
              onClick={() => setActive(index)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                index === active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {place.current && <WeatherIcon code={place.current.symbol} size={22} className="h-5 w-5" />}
              {place.place.name}
              {place.current && <Temp value={place.current.temp} className="font-normal opacity-80" />}
            </button>
          ))}
        </div>
      )}

      <NowPanel key={`now-${active}`} report={current} />
      {forecastReachesTrip ? (
        <ForecastStrip report={current} tripDays={tripDays} />
      ) : (
        nextDeparture && (
          <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            Аялал <span className="font-semibold text-foreground">{shortDate(nextDeparture)}</span>-нд эхэлнэ. Өдөр
            бүрийн нарийн урьдчилсан мэдээ гарахаас 9 хоногийн өмнө энд автоматаар гарч ирнэ — одоогоор тухайн
            сарын олон жилийн дундажийг доор харуулав.
          </p>
        )
      )}
      <ClimatePanel key={`climate-${active}`} report={current} departures={report.departures} />

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Урьдчилсан мэдээ:{" "}
        <a href="https://www.yr.no" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
          MET Norway (yr.no)
        </a>
        , CC BY 4.0 · Уур амьсгалын дундаж:{" "}
        <a href="https://power.larc.nasa.gov" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
          NASA POWER
        </a>
        . Цаг агаар өөрчлөгдөж болзошгүй тул аялахаасаа өмнө дахин шалгаарай.
      </p>
    </div>
  );
}
