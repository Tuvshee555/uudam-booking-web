import { GoogleGenerativeAI } from "@google/generative-ai";
import tzLookup from "@photostructure/tz-lookup";

import type { StoredTripWeather, WeatherPlace } from "@/lib/weather";
import { fetchClimate } from "./climate";

/**
 * Which cities a trip's weather is shown for.
 *
 * Trips arrive from the chatbot sync with no coordinates and a Mongolian
 * title like "<city> – <city> – <city> аялал", often several cities long.
 * So the place list is DERIVED from each trip's own text (title, hotels,
 * day-by-day program) — never from a list in code — once, then stored on
 * the trip where staff can correct it in admin:
 *
 *   trip text ──Gemini──► [{city, country, ISO code}] ──OpenStreetMap──► lat/lon
 *                                                     ──tz-lookup──► timezone
 */

const MAX_PLACES = 4;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "uudam-booking-web/1.0 (+https://uudam-booking-web.vercel.app)";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validTimezone(zone: unknown): zone is string {
  if (typeof zone !== "string" || !zone) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function timezoneFor(lat: number, lon: number): string {
  try {
    return tzLookup(lat, lon);
  } catch {
    return "UTC";
  }
}

function parsePlace(value: unknown): WeatherPlace | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, 80) : "";
  const lat = Number(r.lat);
  const lon = Number(r.lon);
  if (!name || !isFiniteNumber(lat) || !isFiniteNumber(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const climate = r.climate as WeatherPlace["climate"];
  return {
    name,
    country: typeof r.country === "string" ? r.country.trim().slice(0, 80) : "",
    // MET Norway rejects more than 4 decimals; ~10 m precision is plenty.
    lat: Math.round(lat * 1e4) / 1e4,
    lon: Math.round(lon * 1e4) / 1e4,
    timezone: validTimezone(r.timezone) ? r.timezone : timezoneFor(lat, lon),
    climate:
      climate && Array.isArray(climate.months) && climate.months.length === 12 ? climate : null,
  };
}

/** Validates the stored `Trip.weather` JSON. */
export function parseStoredWeather(value: unknown): StoredTripWeather | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  if (!Array.isArray(r.places)) return null;
  return {
    places: r.places.map(parsePlace).filter((p): p is WeatherPlace => p !== null).slice(0, MAX_PLACES),
    source: r.source === "manual" ? "manual" : "auto",
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date(0).toISOString(),
    ...(typeof r.error === "string" && r.error ? { error: r.error.slice(0, 300) } : {}),
  };
}

/** Validates an admin-submitted place list (coordinates come from geocode search). */
export function parsePlacesInput(value: unknown): WeatherPlace[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .map(parsePlace)
    .filter((p): p is WeatherPlace => p !== null)
    .slice(0, MAX_PLACES)
    // Climate is recomputed server-side for the new coordinates, never trusted from the client.
    .map((p) => ({ ...p, climate: null }));
}

// Nominatim's policy: ≤1 request/second, identify yourself. Serialise calls.
let nominatimQueue: Promise<unknown> = Promise.resolve();
function throttledNominatim<T>(run: () => Promise<T>): Promise<T> {
  const next = nominatimQueue.then(run, run);
  nominatimQueue = next.then(
    () => new Promise((r) => setTimeout(r, 1100)),
    () => new Promise((r) => setTimeout(r, 1100)),
  );
  return next;
}

type NominatimHit = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  addresstype?: string;
  address?: { country?: string };
};

async function nominatim(params: Record<string, string>): Promise<NominatimHit[]> {
  const url = `${NOMINATIM_URL}?${new URLSearchParams({ format: "jsonv2", addressdetails: "1", ...params })}`;
  return throttledNominatim(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    return (await res.json()) as NominatimHit[];
  });
}

export type GeocodeResult = { name: string; country: string; lat: number; lon: number; label: string };

/** Admin search box: a city name in Mongolian or English → candidate places, Mongolian names where OSM has them. */
export async function geocodeSearch(query: string): Promise<GeocodeResult[]> {
  const hits = await nominatim({ q: query, limit: "6", "accept-language": "mn,en" });
  return hits.map((hit) => ({
    name: hit.name || hit.display_name.split(",")[0],
    country: hit.address?.country ?? "",
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    label: hit.display_name,
  }));
}

type TripText = {
  title: string;
  hotel?: string | null;
  description?: string | null;
  itinerary?: { title?: string | null; accommodation?: string | null; location?: string | null }[];
};

type DetectedCity = {
  name_mn: string;
  country_mn: string;
  name_en: string;
  region_en?: string;
  country_code: string;
  /** The model's own approximate position — used to pick the right one of
   *  several same-named places, and as the fallback when OSM has no match. */
  lat?: number;
  lon?: number;
};

/** Great-circle distance, km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Two stops this close share a forecast grid cell — one card is enough. */
const SAME_PLACE_KM = 35;
/** An OSM match further than this from the model's own estimate is a different, same-named place. */
const MATCH_RADIUS_KM = 120;

// Latin letters that look identical to Cyrillic ones — a model sometimes
// slips one into a Mongolian word (a Latin "c" in place of "с").
const HOMOGLYPHS: Record<string, string> = {
  a: "а", c: "с", e: "е", o: "о", p: "р", x: "х", y: "у", A: "А", B: "В", C: "С", E: "Е",
  H: "Н", K: "К", M: "М", O: "О", P: "Р", T: "Т", X: "Х",
};

/** Clean a Mongolian place name: no stray Latin homoglyphs, no ALL-CAPS. */
export function cleanPlaceName(raw: string): string {
  let name = raw.trim().replace(/\s+/g, " ");
  if (/[а-яёөү]/i.test(name)) {
    name = name.replace(/[A-Za-z]/g, (ch) => HOMOGLYPHS[ch] ?? ch);
  }
  // Title-case shouting ("МАНЖУУР"), but leave a short single-word
  // abbreviation alone — "БНХАУ" is not a word to capitalise.
  const abbreviation = !/\s/.test(name) && name.length <= 6;
  if (!abbreviation && name.length > 3 && name === name.toUpperCase() && /[А-ЯЁӨҮ]/.test(name)) {
    name = name
      .toLowerCase()
      .replace(/(^|[\s-])([а-яёөүa-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
  }
  return name;
}

/** OpenAI first (the chatbot's working provider), Gemini as the fallback. */
async function askModelForJson(prompt: string): Promise<string> {
  const errors: string[] = [];
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          // Runs once per trip, so pay for geography that is actually right:
          // the mini model put same-named cities 900 km off.
          model: process.env.WEATHER_AI_MODEL || "gpt-4.1",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (content) return content;
      throw new Error("OpenAI returned no content");
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const model = new GoogleGenerativeAI(geminiKey).getGenerativeModel({
        model: process.env.GEN_MODEL || "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      });
      return (await model.generateContent(prompt)).response.text();
    } catch (err) {
      errors.push(err instanceof Error ? err.message.slice(0, 200) : String(err));
    }
  }
  throw new Error(errors.length ? errors.join(" | ") : "No AI provider configured (OPENAI_API_KEY / GEMINI_API_KEY)");
}

async function extractCities(trip: TripText): Promise<DetectedCity[]> {
  const program = (trip.itinerary ?? [])
    .map((day, i) => `${i + 1}. ${[day.title, day.location, day.accommodation].filter(Boolean).join(" | ")}`)
    .join("\n")
    .slice(0, 3000);

  const prompt = `You read a Mongolian travel agency's tour listing and list the destination cities it visits, for showing a weather forecast.

TITLE: ${trip.title}
HOTELS: ${trip.hotel ?? ""}
PROGRAM:
${program}
DESCRIPTION: ${(trip.description ?? "").slice(0, 800)}

Rules:
- Only places travellers actually spend time in (sightseeing or overnight), in visiting order.
- Exclude Ulaanbaatar and anything in Mongolia unless the whole tour is inside Mongolia.
- Every entry must be a city or town. Never a river, sea, lake, desert, region or theme park:
  for those, give the city or resort town where travellers stay for that part of the trip.
- At most ${MAX_PLACES}. Places closer than ~35 km to each other count as one.
- Names can be ambiguous (several cities share one name). Resolve them from the route: consecutive
  stops of a land tour are usually within a day's drive of each other and of the border crossing.
- name_mn: the city name in Mongolian Cyrillic, nominative case, as Mongolian travel agencies write it.
- country_mn: the everyday short country name in Mongolian, never an official abbreviation or full state title.
- name_en: the English city name as on OpenStreetMap; region_en: its province/state.
- country_code: ISO 3166-1 alpha-2 of the country the city is actually in.
- lat/lon: the city centre's approximate coordinates (decimal degrees).
- If the listing names no real destination, return an empty list.

Return JSON only: {"places":[{"name_mn":"","country_mn":"","name_en":"","region_en":"","country_code":"","lat":0,"lon":0}]}`;

  const parsed = JSON.parse(await askModelForJson(prompt)) as { places?: DetectedCity[] };
  return (parsed.places ?? [])
    .filter((p) => p && typeof p.name_en === "string" && p.name_en.trim())
    .slice(0, MAX_PLACES + 2);
}

function modelPoint(city: DetectedCity): { lat: number; lon: number } | null {
  const lat = Number(city.lat);
  const lon = Number(city.lon);
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon) || (lat === 0 && lon === 0)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/**
 * Coordinates for a detected city. OpenStreetMap is the authority, but a
 * bare name is ambiguous (two cities can share one; a river can share a
 * city's name) — so among OSM's populated-place matches, take the one
 * nearest the model's own estimate. No match near it → trust the estimate,
 * which is plenty for a ~10 km weather grid.
 */
async function geocodeCity(city: DetectedCity): Promise<{ lat: number; lon: number; country: string } | null> {
  const code = /^[a-z]{2}$/i.test(city.country_code) ? city.country_code.toLowerCase() : undefined;
  const estimate = modelPoint(city);
  const query = [city.name_en, city.region_en].filter(Boolean).join(", ");
  const hits = await nominatim({
    q: query,
    limit: "6",
    // Mongolian first so the country name can fill a gap the model left.
    "accept-language": "mn,en",
    ...(code ? { countrycodes: code } : {}),
  }).catch(() => [] as NominatimHit[]);

  const places = hits
    .filter((h) => h.category === "place" || h.category === "boundary")
    .map((h) => ({ lat: Number(h.lat), lon: Number(h.lon), country: h.address?.country ?? "" }))
    .filter((h) => isFiniteNumber(h.lat) && isFiniteNumber(h.lon));

  if (estimate) {
    const nearest = places
      .map((p) => ({ ...p, km: distanceKm(p, estimate) }))
      .sort((a, b) => a.km - b.km)[0];
    if (nearest && nearest.km <= MATCH_RADIUS_KM) return nearest;
    return { ...estimate, country: places[0]?.country ?? "" };
  }
  return places[0] ?? null;
}

/** Attach climate normals to every place that lacks them. Never throws. */
export async function withClimate(places: WeatherPlace[]): Promise<WeatherPlace[]> {
  return Promise.all(
    places.map(async (place) =>
      place.climate ? place : { ...place, climate: await fetchClimate(place.lat, place.lon).catch(() => null) },
    ),
  );
}

/** Detect a trip's weather places from its own text. Returns [] when nothing is found. */
export async function detectPlaces(trip: TripText): Promise<WeatherPlace[]> {
  const cities = await extractCities(trip);
  const places: WeatherPlace[] = [];
  for (const city of cities) {
    if (places.length >= MAX_PLACES) break;
    const point = await geocodeCity(city).catch(() => null);
    if (!point || !isFiniteNumber(point.lat) || !isFiniteNumber(point.lon)) continue;
    if (places.some((p) => distanceKm(p, point) < SAME_PLACE_KM)) continue;
    const place = parsePlace({
      name: cleanPlaceName(city.name_mn || city.name_en),
      country: cleanPlaceName(city.country_mn || point.country),
      lat: point.lat,
      lon: point.lon,
    });
    if (place) places.push(place);
  }
  return withClimate(places);
}
