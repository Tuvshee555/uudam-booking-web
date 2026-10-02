import type { CurrentWeather, ForecastDay } from "@/lib/weather";

/**
 * MET Norway Locationforecast 2.0 — the model behind yr.no. Free for
 * commercial use under CC BY 4.0 (attribution shown on the card), global
 * coverage, ~9 days ahead. Their terms require an identifying User-Agent,
 * at most 4 coordinate decimals, and caching — Next's fetch cache serves
 * every visitor (and the chatbot) from one response per place per 30 min.
 */
const MET_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const USER_AGENT = "uudam-booking-web/1.0 (+https://uudam-booking-web.vercel.app)";
const FORECAST_REVALIDATE_SECONDS = 1800;

type MetDetails = {
  air_temperature?: number;
  relative_humidity?: number;
  wind_speed?: number;
  precipitation_amount?: number;
  air_temperature_max?: number;
  air_temperature_min?: number;
};
type MetPeriod = { summary?: { symbol_code?: string }; details?: MetDetails };
type MetStep = {
  time: string;
  data: {
    instant: { details: MetDetails };
    next_1_hours?: MetPeriod;
    next_6_hours?: MetPeriod;
    next_12_hours?: MetPeriod;
  };
};

export type Forecast = { current: CurrentWeather | null; daily: ForecastDay[] };

function localParts(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

const HOUR = 3600_000;

/** Pure: MET timeseries → current conditions + local-calendar days. */
export function summarizeForecast(steps: MetStep[], timeZone: string, now = Date.now()): Forecast {
  // A cached response can be up to half an hour old, so "now" is the latest
  // step that has already started, not blindly the first one.
  steps = steps.filter((step, i) => i === steps.length - 1 || Date.parse(steps[i + 1].time) > now);
  if (!steps.length) return { current: null, daily: [] };

  const first = steps[0];
  const firstSymbol =
    first.data.next_1_hours?.summary?.symbol_code ?? first.data.next_6_hours?.summary?.symbol_code;
  const current: CurrentWeather | null =
    typeof first.data.instant.details.air_temperature === "number" && firstSymbol
      ? {
          time: first.time,
          temp: first.data.instant.details.air_temperature,
          humidity: first.data.instant.details.relative_humidity ?? null,
          windMs: first.data.instant.details.wind_speed ?? null,
          symbol: firstSymbol,
        }
      : null;

  type Acc = { temps: number[]; precip: number; symbol?: string; symbolDistance: number };
  const days = new Map<string, Acc>();
  const day = (date: string) => {
    let acc = days.get(date);
    if (!acc) {
      acc = { temps: [], precip: 0, symbolDistance: Infinity };
      days.set(date, acc);
    }
    return acc;
  };

  // Precipitation: walk the series once, always taking the finest period
  // that starts where the last one ended, so hourly and 6-hourly blocks
  // never double count.
  let coveredUntil = 0;
  for (const step of steps) {
    const t = Date.parse(step.time);
    const { date, hour } = localParts(step.time, timeZone);
    const acc = day(date);

    const temp = step.data.instant.details.air_temperature;
    if (typeof temp === "number") acc.temps.push(temp);

    const six = step.data.next_6_hours;
    if (six?.details) {
      // A 6-hour block's own max/min catch the afternoon peak the coarse
      // 6-hourly instants step over; credit them to the block's midpoint day.
      const mid = localParts(new Date(t + 3 * HOUR).toISOString(), timeZone).date;
      const midAcc = day(mid);
      if (typeof six.details.air_temperature_max === "number") midAcc.temps.push(six.details.air_temperature_max);
      if (typeof six.details.air_temperature_min === "number") midAcc.temps.push(six.details.air_temperature_min);
    }

    if (t >= coveredUntil) {
      const one = step.data.next_1_hours?.details?.precipitation_amount;
      const sixP = six?.details?.precipitation_amount;
      if (typeof one === "number") {
        acc.precip += one;
        coveredUntil = t + HOUR;
      } else if (typeof sixP === "number") {
        acc.precip += sixP;
        coveredUntil = t + 6 * HOUR;
      }
    }

    // The day's icon is the 6-hour outlook nearest late morning — the sky
    // people will actually be sightseeing under.
    const symbol = six?.summary?.symbol_code;
    if (symbol) {
      const distance = Math.abs(hour - 11);
      if (distance < acc.symbolDistance) {
        acc.symbol = symbol;
        acc.symbolDistance = distance;
      }
    }
  }

  const today = localParts(new Date(now).toISOString(), timeZone).date;
  const daily: ForecastDay[] = [];
  for (const [date, acc] of [...days.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (date < today) continue;
    // A trailing day with one late step has no real midday picture — drop it
    // rather than show a "high" that is really a 2am reading.
    if (!acc.symbol || acc.temps.length < 2 || acc.symbolDistance > 6) continue;
    daily.push({
      date,
      hi: Math.max(...acc.temps),
      lo: Math.min(...acc.temps),
      precipMm: Math.round(acc.precip * 10) / 10,
      // Daily tiles are daytime summaries: always the day variant.
      symbol: acc.symbol.replace(/_(night|polartwilight)$/, "_day"),
    });
  }

  return { current, daily };
}

export async function fetchForecast(lat: number, lon: number, timeZone: string): Promise<Forecast | null> {
  const url = `${MET_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      next: { revalidate: FORECAST_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("MET forecast failed", res.status, url);
      return null;
    }
    const body = (await res.json()) as { properties?: { timeseries?: MetStep[] } };
    return summarizeForecast(body.properties?.timeseries ?? [], timeZone);
  } catch (err) {
    console.error("MET forecast error", url, err);
    return null;
  }
}
