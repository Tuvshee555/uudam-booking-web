import { prisma, withPrismaRetry } from "@/server/prisma";
import {
  WEATHER_ATTRIBUTION,
  typicalDaySymbol,
  packingTip,
  type StoredTripWeather,
  type TripWeatherDay,
  type TripWeatherReport,
} from "@/lib/weather";
import { fetchForecast, type Forecast } from "./forecast";
import { typicalForDate } from "./climate";
import { detectPlaces, parseStoredWeather, resolveDayPlaces, withClimate } from "./places";
import { buildWeatherText } from "./text";
import { departureDateKey } from "@/lib/departureDate";

/** The agency's own calendar — departures are dated in Ulaanbaatar time. */
const HOME_TIMEZONE = "Asia/Ulaanbaatar";
/** MET Norway's model runs ~9 days ahead; beyond that there is no forecast, only normals. */
const FORECAST_DAYS = 9;
const DAY_MS = 86_400_000;
/** How many upcoming days to show per city when the trip itself is out of forecast reach. */
const NOW_DAYS = 5;

function todayAt(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

function addDays(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const TRIP_SELECT = {
  id: true,
  slug: true,
  title: true,
  hotel: true,
  description: true,
  durationDays: true,
  weather: true,
  isPublished: true,
  itinerary: { select: { title: true, accommodation: true, location: true }, orderBy: { dayNumber: "asc" as const } },
  departures: { select: { startDate: true, status: true }, orderBy: { startDate: "asc" as const } },
};

type LoadedTrip = NonNullable<Awaited<ReturnType<typeof loadTrip>>>;

async function loadTrip(where: { id?: string; slug?: string; sourceTripId?: string }) {
  const filters = Object.entries(where)
    .filter(([, value]) => value)
    .map(([key, value]) => ({ [key]: value }));
  if (!filters.length) return null;
  return withPrismaRetry(() => prisma.trip.findFirst({ where: { OR: filters }, select: TRIP_SELECT }));
}

async function saveWeather(tripId: string, weather: StoredTripWeather) {
  await withPrismaRetry(() =>
    prisma.trip.update({ where: { id: tripId }, data: { weather: weather as object } }),
  );
}

const DETECTION_RETRY_MS = 6 * 3600_000;

/**
 * The trip's stored places + day map, detecting them on first use (or when
 * an older detection has no day map yet) and back-filling missing climate
 * normals. An empty result is stored too, so a trip with no findable
 * destination doesn't call the model on every page view.
 */
export async function ensureTripPlaces(
  trip: LoadedTrip,
  { redetect = false, throwOnError = false } = {},
): Promise<StoredTripWeather> {
  const stored = parseStoredWeather(trip.weather);
  const failedLongAgo =
    stored?.error && Date.now() - Date.parse(stored.updatedAt) > DETECTION_RETRY_MS && stored.source === "auto";
  // Auto detections made before day mapping existed are upgraded once.
  const missingDayMap = stored?.source === "auto" && stored.places.length > 0 && !stored.dayPlaces && !stored.error;
  if (stored && !redetect && !failedLongAgo && !missingDayMap) {
    if (stored.places.every((p) => p.climate)) return stored;
    const places = await withClimate(stored.places);
    const next = { ...stored, places, updatedAt: new Date().toISOString() };
    if (places.every((p) => p.climate)) await saveWeather(trip.id, next).catch(() => {});
    return next;
  }

  try {
    const { places, dayPlaces } = await detectPlaces({
      title: trip.title,
      hotel: trip.hotel,
      description: trip.description,
      itinerary: trip.itinerary,
      durationDays: trip.durationDays,
    });
    const next: StoredTripWeather = { places, dayPlaces, source: "auto", updatedAt: new Date().toISOString() };
    await saveWeather(trip.id, next);
    return next;
  } catch (err) {
    // An AI/geocoder outage must never break the trip page or the bot:
    // keep whatever places we had, note the failure, retry in a few hours.
    const message = err instanceof Error ? err.message : String(err);
    console.error("Weather place detection failed for trip", trip.id, message);
    const keep: StoredTripWeather = {
      places: stored?.places ?? [],
      ...(stored?.dayPlaces ? { dayPlaces: stored.dayPlaces } : {}),
      source: stored?.source ?? "auto",
      updatedAt: new Date().toISOString(),
      error: message.slice(0, 300),
    };
    await saveWeather(trip.id, keep).catch(() => {});
    if (throwOnError) throw err;
    return keep;
  }
}

export function upcomingDepartures(trip: Pick<LoadedTrip, "departures">): string[] {
  const today = todayAt(HOME_TIMEZONE);
  return [
    ...new Set(
      trip.departures
        .filter((d) => d.status !== "CANCELLED")
        .map((d) => departureDateKey(d.startDate))
        .filter((date) => date >= today),
    ),
  ];
}

/** The departure a request is about: the asked date's departure, else the next one on/after it. */
function pickDeparture(departures: string[], asked: string | undefined): string | null {
  if (asked && /^\d{4}-\d{2}-\d{2}$/.test(asked)) {
    return departures.find((d) => d >= asked) ?? asked;
  }
  return departures[0] ?? null;
}

export async function buildTripWeatherReport(
  trip: LoadedTrip,
  stored: StoredTripWeather,
  askedDate?: string,
): Promise<TripWeatherReport> {
  const today = todayAt(HOME_TIMEZONE);
  const departures = upcomingDepartures(trip);
  const departure = pickDeparture(departures, askedDate);
  const start = departure ?? today;
  const dayCount = Math.max(1, trip.durationDays || 0, trip.itinerary.length);
  const placeOfDay = resolveDayPlaces(stored.places, stored.dayPlaces, dayCount);
  const lastForecastDate = addDays(today, FORECAST_DAYS);

  // Only fetch forecasts for places the traveller is in on a date that a
  // forecast can actually reach — a trip next month needs no API call.
  const needForecast = new Set<number>();
  placeOfDay.forEach((place, i) => {
    if (place !== null && addDays(start, i) <= lastForecastDate) needForecast.add(place);
  });
  const forecasts = new Map<number, Forecast | null>();
  await Promise.all(
    [...needForecast].map(async (index) => {
      const place = stored.places[index];
      forecasts.set(index, await fetchForecast(place.lat, place.lon, place.timezone));
    }),
  );

  const days: TripWeatherDay[] = placeOfDay.map((placeIndex, i) => {
    const date = addDays(start, i);
    const base: TripWeatherDay = {
      day: i + 1, date, place: placeIndex, source: null,
      hi: null, lo: null, symbol: null, precipMm: null, rainChance: null,
    };
    if (placeIndex === null) return base;
    const forecastDay = forecasts.get(placeIndex)?.daily.find((d) => d.date === date);
    if (forecastDay) {
      return {
        ...base, source: "forecast", hi: forecastDay.hi, lo: forecastDay.lo,
        symbol: forecastDay.symbol, precipMm: forecastDay.precipMm,
      };
    }
    const months = stored.places[placeIndex]?.climate?.months;
    if (!months) return base;
    const typical = typicalForDate(months, date);
    return {
      ...base, source: "typical", hi: typical.hi, lo: typical.lo,
      symbol: typicalDaySymbol(typical.hi, typical.rainChance, typical.month.cloud), rainChance: typical.rainChance,
    };
  });

  // One packing tip for the whole stay: warmest day, coldest night, how wet.
  const known = days.filter((d) => d.hi !== null && d.lo !== null);
  const packing = known.length
    ? packingTip({
        hi: Math.max(...known.map((d) => d.hi!)),
        lo: Math.min(...known.map((d) => d.lo!)),
        rainDays:
          (known.reduce(
            (sum, d) => sum + (d.source === "forecast" ? ((d.precipMm ?? 0) >= 2 ? 100 : 0) : (d.rainChance ?? 0)),
            0,
          ) / known.length / 100) * 30.4,
        cloud: null,
      })
    : null;

  // No trip day is within forecast reach yet: rather than an empty card,
  // show what it is like in the trip's cities right now (labelled "now").
  // The usual weather for the trip dates still drives the packing line.
  let now: TripWeatherReport["now"] = [];
  if (needForecast.size === 0) {
    const order = [...new Set(placeOfDay.filter((p): p is number => p !== null))];
    now = (
      await Promise.all(
        order.map(async (index) => {
          const place = stored.places[index];
          const forecast = await fetchForecast(place.lat, place.lon, place.timezone);
          return { place: index, days: forecast?.daily.slice(0, NOW_DAYS) ?? [] };
        }),
      )
    ).filter((entry) => entry.days.length > 0);
  }
  const mode: TripWeatherReport["mode"] = needForecast.size === 0 && now.length > 0 ? "current" : "trip";
  const usual = known.length
    ? { hi: Math.max(...known.map((d) => d.hi!)), lo: Math.min(...known.map((d) => d.lo!)) }
    : null;

  const forecastFrom = departure && departure > lastForecastDate ? addDays(departure, -FORECAST_DAYS) : null;
  const places = stored.places.map((p) => ({ name: p.name, country: p.country, lat: p.lat, lon: p.lon, timezone: p.timezone }));

  const report: Omit<TripWeatherReport, "text"> = {
    tripId: trip.id,
    tripSlug: trip.slug,
    tripTitle: trip.title,
    places,
    departure,
    departures,
    days,
    mode,
    now,
    usual,
    forecastFrom,
    packing,
    attribution: WEATHER_ATTRIBUTION,
    generatedAt: new Date().toISOString(),
  };
  return { ...report, text: buildWeatherText(report) };
}

/** Public entry point: any of the trip's ids (+ optional departure date) → weather report, or null. */
export async function getTripWeather(key: { id?: string; slug?: string; sourceTripId?: string }, date?: string) {
  const trip = await loadTrip(key);
  if (!trip) return null;
  return buildTripWeatherReport(trip, await ensureTripPlaces(trip), date);
}

export { loadTrip as loadTripForWeather };
