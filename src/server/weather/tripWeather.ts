import { prisma, withPrismaRetry } from "@/server/prisma";
import {
  WEATHER_ATTRIBUTION,
  type StoredTripWeather,
  type TripWeatherReport,
  type WeatherPlace,
} from "@/lib/weather";
import { fetchForecast } from "./forecast";
import { detectPlaces, parseStoredWeather, withClimate } from "./places";
import { buildWeatherText } from "./text";

/** The agency's own calendar — departures are dated in Ulaanbaatar time. */
const HOME_TIMEZONE = "Asia/Ulaanbaatar";

function todayAt(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

const TRIP_SELECT = {
  id: true,
  slug: true,
  title: true,
  hotel: true,
  description: true,
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

/**
 * The trip's stored places, detecting them on first use and back-filling
 * any missing climate normals. Detection runs once per trip — an empty
 * result is stored too, so a trip with no findable destination doesn't
 * call the model on every page view (staff can re-run it in admin).
 */
const DETECTION_RETRY_MS = 6 * 3600_000;

export async function ensureTripPlaces(
  trip: LoadedTrip,
  { redetect = false, throwOnError = false } = {},
): Promise<WeatherPlace[]> {
  const stored = parseStoredWeather(trip.weather);
  const failedLongAgo =
    stored?.error && Date.now() - Date.parse(stored.updatedAt) > DETECTION_RETRY_MS && stored.source === "auto";
  if (stored && !redetect && !failedLongAgo) {
    if (stored.places.every((p) => p.climate)) return stored.places;
    const places = await withClimate(stored.places);
    if (places.every((p) => p.climate)) {
      await saveWeather(trip.id, { ...stored, places, updatedAt: new Date().toISOString() }).catch(() => {});
    }
    return places;
  }

  try {
    const places = await detectPlaces({
      title: trip.title,
      hotel: trip.hotel,
      description: trip.description,
      itinerary: trip.itinerary,
    });
    await saveWeather(trip.id, { places, source: "auto", updatedAt: new Date().toISOString() });
    return places;
  } catch (err) {
    // An AI/geocoder outage must never break the trip page or the bot:
    // keep whatever places we had, note the failure, retry in a few hours.
    const message = err instanceof Error ? err.message : String(err);
    console.error("Weather place detection failed for trip", trip.id, message);
    const keep = stored?.places ?? [];
    await saveWeather(trip.id, {
      places: keep,
      source: stored?.source ?? "auto",
      updatedAt: new Date().toISOString(),
      error: message.slice(0, 300),
    }).catch(() => {});
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
        .map((d) => d.startDate.toISOString().slice(0, 10))
        .filter((date) => date >= today),
    ),
  ];
}

export async function buildTripWeatherReport(trip: LoadedTrip, places: WeatherPlace[]): Promise<TripWeatherReport> {
  const reports = await Promise.all(
    places.map(async (place) => {
      const forecast = await fetchForecast(place.lat, place.lon, place.timezone);
      const { climate, ...rest } = place;
      return {
        place: rest,
        current: forecast?.current ?? null,
        daily: forecast?.daily ?? [],
        climate: climate ?? null,
      };
    }),
  );
  const departures = upcomingDepartures(trip);
  return {
    tripId: trip.id,
    tripSlug: trip.slug,
    tripTitle: trip.title,
    places: reports,
    departures,
    text: buildWeatherText({ tripTitle: trip.title, places: reports, departures, today: todayAt(HOME_TIMEZONE) }),
    attribution: WEATHER_ATTRIBUTION,
    generatedAt: new Date().toISOString(),
  };
}

/** Public entry point: any of the trip's ids → full weather report, or null if no such trip. */
export async function getTripWeather(key: { id?: string; slug?: string; sourceTripId?: string }) {
  const trip = await loadTrip(key);
  if (!trip) return null;
  const places = await ensureTripPlaces(trip);
  return buildTripWeatherReport(trip, places);
}

export { loadTrip as loadTripForWeather };
