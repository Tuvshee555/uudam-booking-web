import type { ClimateMonth, ClimateNormals } from "@/lib/weather";

/**
 * Monthly climate normals for trips beyond the ~9-day forecast window —
 * "what is it usually like there in November". NASA POWER, public domain.
 *
 * Built from ten years of DAILY values on purpose: POWER's own
 * "climatology" product reports T2M_MAX/T2M_MIN as the period's record
 * extremes (a tropical city's "January max" ~7°C above its real average high), not the average high a traveler
 * means. Averaging the daily series lands within ~1°C of station normals
 * (checked against station normals for tropical, Mediterranean,
 * subtropical and continental destinations). Rainy days count
 * days with ≥2 mm — the reanalysis drizzles lightly on far too many days at
 * a 1 mm cut, and 2 mm matches station rain-day counts.
 */
const POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";
const RAIN_DAY_MM = 2;
const YEARS = 10;

type PowerSeries = Record<string, number>;

/** Pure: daily POWER series → per-calendar-month averages. */
export function summarizeClimate(params: {
  T2M_MAX: PowerSeries;
  T2M_MIN: PowerSeries;
  PRECTOTCORR: PowerSeries;
  CLOUD_AMT?: PowerSeries;
}): ClimateMonth[] | null {
  const acc = Array.from({ length: 12 }, () => ({ hi: 0, lo: 0, wet: 0, n: 0, cloud: 0, cloudN: 0 }));
  for (const [date, hi] of Object.entries(params.T2M_MAX)) {
    const lo = params.T2M_MIN[date];
    const precip = params.PRECTOTCORR[date];
    if (hi === -999 || lo === undefined || lo === -999 || precip === undefined || precip === -999) continue;
    const m = acc[Number(date.slice(4, 6)) - 1];
    if (!m) continue;
    m.hi += hi;
    m.lo += lo;
    m.n += 1;
    if (precip >= RAIN_DAY_MM) m.wet += 1;
    const cloud = params.CLOUD_AMT?.[date];
    if (typeof cloud === "number" && cloud !== -999) {
      m.cloud += cloud;
      m.cloudN += 1;
    }
  }
  if (acc.some((m) => m.n < 50)) return null; // fewer than ~2 years of a month → not a normal
  return acc.map((m, index) => {
    const daysInMonth = new Date(Date.UTC(2001, index + 1, 0)).getUTCDate();
    return {
      hi: Math.round((m.hi / m.n) * 10) / 10,
      lo: Math.round((m.lo / m.n) * 10) / 10,
      rainDays: Math.round((m.wet / m.n) * daysInMonth * 10) / 10,
      cloud: m.cloudN ? Math.round(m.cloud / m.cloudN) : null,
    };
  });
}

export async function fetchClimate(lat: number, lon: number): Promise<ClimateNormals | null> {
  const lastYear = new Date().getUTCFullYear() - 1;
  const firstYear = lastYear - YEARS + 1;
  const url =
    `${POWER_URL}?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,CLOUD_AMT&community=AG` +
    `&latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&start=${firstYear}0101&end=${lastYear}1231&format=JSON`;
  try {
    const res = await fetch(url, {
      // Normals do not move; they are also stored on the trip once computed.
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error("NASA POWER failed", res.status, url);
      return null;
    }
    const body = (await res.json()) as {
      properties?: { parameter?: Parameters<typeof summarizeClimate>[0] };
    };
    const parameter = body.properties?.parameter;
    if (!parameter?.T2M_MAX || !parameter.T2M_MIN || !parameter.PRECTOTCORR) return null;
    const months = summarizeClimate(parameter);
    return months ? { months, period: `NASA POWER ${firstYear}–${lastYear}` } : null;
  } catch (err) {
    console.error("NASA POWER error", url, err);
    return null;
  }
}
