/**
 * Weather vocabulary shared by the trip page, the API and the chatbot text —
 * client-safe (no server imports). One mapping from a weather code to an
 * icon, a Mongolian label and an emoji, so the website card and the
 * Messenger answer can never describe the same sky two different ways.
 *
 * Forecast codes are MET Norway's `symbol_code` (e.g. "lightrainshowers_day",
 * "heavyrainandthunder") — parsed by structure, not looked up in a fixed list,
 * so every one of their ~80 codes resolves.
 */

/** One stop on a trip that has its own weather. */
export type WeatherPlace = {
  /** Display name in Mongolian, e.g. as staff would write it. */
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** IANA zone, e.g. "Europe/Paris" — days and "now" are in local time. */
  timezone: string;
  climate?: ClimateNormals | null;
};

/** Average conditions per calendar month (index 0 = January). */
export type ClimateNormals = {
  months: ClimateMonth[];
  /** Human-readable source/period, e.g. "NASA POWER 2016–2025". */
  period: string;
};

export type ClimateMonth = {
  /** Average daily high / low, °C. */
  hi: number;
  lo: number;
  /** Average number of days with ≥2 mm of precipitation. */
  rainDays: number;
  /** Average cloud cover, %. */
  cloud: number | null;
};

export type StoredTripWeather = {
  places: WeatherPlace[];
  /** "auto" = detected from trip text; "manual" = staff picked the places. */
  source: "auto" | "manual";
  updatedAt: string;
  /** Why the last auto-detection failed (AI/geocoder down) — retried later. */
  error?: string;
};

export type ForecastDay = {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  hi: number;
  lo: number;
  precipMm: number;
  symbol: string;
};

export type CurrentWeather = {
  /** ISO instant the observation-like first forecast step is valid for. */
  time: string;
  temp: number;
  humidity: number | null;
  windMs: number | null;
  symbol: string;
};

export type PlaceWeatherReport = {
  place: Omit<WeatherPlace, "climate">;
  current: CurrentWeather | null;
  daily: ForecastDay[];
  climate: ClimateNormals | null;
};

export type TripWeatherReport = {
  tripId: string;
  tripSlug: string;
  tripTitle: string;
  places: PlaceWeatherReport[];
  /** Upcoming departure dates (YYYY-MM-DD), soonest first. */
  departures: string[];
  /** Plain-text Mongolian summary — exactly what the chatbot sends. */
  text: string;
  attribution: string;
  generatedAt: string;
};

type Parsed = {
  base: "clearsky" | "fair" | "partlycloudy" | "cloudy" | "fog" | "rain" | "sleet" | "snow";
  intensity: "light" | "normal" | "heavy";
  showers: boolean;
  thunder: boolean;
  night: boolean;
};

export function parseSymbol(code: string): Parsed {
  const night = /_night$/.test(code) || /_polartwilight$/.test(code);
  const core = code.replace(/_(day|night|polartwilight)$/, "");
  const thunder = core.includes("thunder");
  const showers = core.includes("showers");
  const intensity = core.startsWith("heavy") ? "heavy" : core.startsWith("light") ? "light" : "normal";

  let base: Parsed["base"] = "cloudy";
  if (core.includes("snow")) base = "snow";
  else if (core.includes("sleet")) base = "sleet";
  else if (core.includes("rain")) base = "rain";
  else if (core.startsWith("clearsky")) base = "clearsky";
  else if (core.startsWith("fair")) base = "fair";
  else if (core.startsWith("partlycloudy")) base = "partlycloudy";
  else if (core.startsWith("fog")) base = "fog";
  // "thunder" alone (rare) still reads as a storm.
  if (thunder && (base === "cloudy" || base === "partlycloudy" || base === "fair")) base = "rain";

  return { base, intensity, showers, thunder, night };
}

/** Path of the animated icon for a code, under /public/weather-icons. */
export function weatherIcon(code: string): string {
  const s = parseSymbol(code);
  const dn = s.night ? "night" : "day";
  let name: string;

  if (s.thunder) {
    name =
      s.base === "snow" ? "thunderstorms-snow"
      : s.base === "sleet" ? "thunderstorms-sleet"
      : s.showers ? `thunderstorms-${dn}-rain`
      : "thunderstorms-rain";
  } else {
    switch (s.base) {
      case "clearsky": name = `clear-${dn}`; break;
      case "fair": name = `mostly-clear-${dn}`; break;
      case "partlycloudy": name = `partly-cloudy-${dn}`; break;
      case "cloudy": name = "cloudy"; break;
      case "fog": name = `fog-${dn}`; break;
      case "rain":
        if (s.showers) name = s.intensity === "light" ? `partly-cloudy-${dn}-drizzle` : `partly-cloudy-${dn}-rain`;
        else name = s.intensity === "light" ? "drizzle" : s.intensity === "heavy" ? "overcast-rain" : "rain";
        break;
      case "sleet": name = s.showers ? `partly-cloudy-${dn}-sleet` : "sleet"; break;
      case "snow":
        name = s.showers ? `partly-cloudy-${dn}-snow` : s.intensity === "heavy" ? "overcast-snow" : "snow";
        break;
    }
  }
  return `/weather-icons/${name}.svg`;
}

/** Broadcast-style Mongolian description, e.g. "Аянгатай аадар бороо". */
export function weatherLabel(code: string): string {
  const s = parseSymbol(code);
  let label: string;
  switch (s.base) {
    case "clearsky": label = s.night ? "Цэлмэг" : "Цэлмэг, нартай"; break;
    case "fair": label = "Үүл багатай"; break;
    case "partlycloudy": label = "Үүлшинэ"; break;
    case "cloudy": label = "Үүлэрхэг"; break;
    case "fog": label = "Манантай"; break;
    case "rain":
      label = s.showers
        ? s.intensity === "heavy" ? "Аадар бороо" : s.intensity === "light" ? "Түр зуурын бага зэрэг бороо" : "Түр зуурын бороо"
        : s.intensity === "heavy" ? "Их бороо" : s.intensity === "light" ? "Бага зэрэг бороо" : "Бороо";
      break;
    case "sleet":
      label = s.intensity === "heavy" ? "Их нойтон цас" : s.intensity === "light" ? "Бага зэрэг нойтон цас" : "Нойтон цас";
      break;
    case "snow":
      label = s.showers
        ? "Түр зуурын цас"
        : s.intensity === "heavy" ? "Их цас" : s.intensity === "light" ? "Бага зэрэг цас" : "Цас";
      break;
  }
  if (s.thunder) label = `Аянгатай ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
  return label;
}

export function weatherEmoji(code: string): string {
  const s = parseSymbol(code);
  if (s.thunder) return "⛈";
  switch (s.base) {
    case "clearsky": return s.night ? "🌙" : "☀️";
    case "fair": return s.night ? "🌙" : "🌤";
    case "partlycloudy": return "⛅";
    case "cloudy": return "☁️";
    case "fog": return "🌫";
    case "rain": return s.showers ? "🌦" : "🌧";
    case "sleet": return "🌨";
    case "snow": return "❄️";
  }
}

/** Visual mood for the card background: sunny / cloudy / wet / snowy / night. */
export function weatherMood(code: string): "sun" | "cloud" | "rain" | "snow" | "night" {
  const s = parseSymbol(code);
  if (s.base === "snow" || s.base === "sleet") return "snow";
  if (s.base === "rain" || s.thunder) return "rain";
  if (s.night) return "night";
  if (s.base === "clearsky" || s.base === "fair") return "sun";
  return "cloud";
}

/**
 * A representative symbol code for a month of climate normals — sun for dry
 * clear months, showers for wet ones, snow when it is cold and wet. Expressed
 * in the same code language so the same icon/label/emoji helpers apply.
 */
export function climateSymbol(month: ClimateMonth): string {
  const cold = month.hi <= 2;
  if (month.rainDays >= 12) return cold ? "snow" : "rain";
  if (month.rainDays >= 6) return cold ? "snowshowers_day" : "rainshowers_day";
  const cloud = month.cloud ?? 40;
  if (cloud < 35) return "clearsky_day";
  if (cloud < 60) return "fair_day";
  return "partlycloudy_day";
}

/** How the month feels, in one word: "Халуун", "Дулаан", "Сэрүүн"… */
export function climateFeel(month: ClimateMonth): string {
  const mid = (month.hi + month.lo) / 2;
  if (month.hi >= 30) return "Халуун";
  if (mid >= 20) return "Дулаан";
  if (mid >= 12) return "Сэрүүвтэр";
  if (mid >= 3) return "Сэрүүн";
  if (mid >= -8) return "Хүйтэн";
  return "Тачигнасан хүйтэн";
}

/** A packing tip from the month's normals — the "what do I bring" question. */
export function packingTip(month: ClimateMonth): string {
  const parts: string[] = [];
  if (month.hi >= 28) parts.push("нимгэн, агаар нэвтрүүлэх хувцас, малгай, нарны тос");
  else if (month.hi >= 20) parts.push("хөнгөн хувцас, орой өмсөх нимгэн цамц");
  else if (month.hi >= 10) parts.push("давхарлаж өмсөх хувцас, хүрэм");
  else if (month.hi >= 0) parts.push("дулаан куртка, малгай, бээлий");
  else parts.push("зузаан өвлийн куртка, дулаан гутал, малгай, бээлий");
  if (month.hi >= 20 && month.lo < 12) parts.push("шөнө сэрүүн тул дулаан цамц");
  if (month.rainDays >= 6) parts.push("шүхэр эсвэл борооны цув");
  return parts.join(", ");
}

const WEEKDAYS_SHORT = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

/** "Мя" for a YYYY-MM-DD date — weekday of the calendar date itself. */
export function weekdayShort(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "10/08" for a YYYY-MM-DD date. */
export function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${m}/${d}`;
}

export function monthName(index: number): string {
  return `${index + 1}-р сар`;
}

export function roundTemp(value: number): number {
  const rounded = Math.round(value);
  return Object.is(rounded, -0) ? 0 : rounded;
}

export const WEATHER_ATTRIBUTION =
  "Цаг агаарын урьдчилсан мэдээ: MET Norway (yr.no), CC BY 4.0 · Уур амьсгалын дундаж: NASA POWER";
