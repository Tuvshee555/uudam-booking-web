import {
  climateFeel,
  climateSymbol,
  monthName,
  packingTip,
  roundTemp,
  shortDate,
  weatherEmoji,
  weatherLabel,
  weekdayShort,
  type ClimateMonth,
  type PlaceWeatherReport,
} from "@/lib/weather";

/**
 * The plain-text weather answer — built here, next to the data, and sent
 * verbatim by the Messenger bot (via /api/weather), so the chat and the
 * website card always say the same thing.
 */

const deg = (value: number) => `${roundTemp(value)}°`;

/** The calendar month the traveller will be there: next departure, else this month. */
export function travelMonthIndex(departures: string[], today: string): number {
  const date = departures[0] ?? today;
  return Number(date.slice(5, 7)) - 1;
}

function climateLine(month: ClimateMonth, index: number): string {
  const rain = Math.round(month.rainDays);
  const rainText = rain <= 1 ? "бороо бараг ордоггүй" : `сардаа ~${rain} өдөр бороо орно`;
  return `${monthName(index)}ын дундаж: ${weatherEmoji(climateSymbol(month))} өдөртөө ${deg(month.hi)}C, шөнөдөө ${deg(month.lo)}C, ${rainText} (${climateFeel(month).toLowerCase()})`;
}

function currentLine(report: PlaceWeatherReport, detailed: boolean): string | null {
  const c = report.current;
  if (!c) return null;
  const extras = !detailed ? [] : [
    c.humidity !== null ? `чийгшил ${Math.round(c.humidity)}%` : null,
    c.windMs !== null ? `салхи ${Math.round(c.windMs)} м/с` : null,
  ].filter(Boolean);
  return `Одоо: ${weatherEmoji(c.symbol)} ${deg(c.temp)}C, ${weatherLabel(c.symbol)}${extras.length ? ` · ${extras.join(", ")}` : ""}`;
}

export function buildWeatherText(input: {
  tripTitle: string;
  places: PlaceWeatherReport[];
  departures: string[];
  today: string;
}): string {
  const { places, departures, today } = input;
  if (!places.length) return "";

  const monthIndex = travelMonthIndex(departures, today);
  const nextDeparture = departures[0];
  const lines: string[] = [];
  const single = places.length === 1;

  lines.push(
    single
      ? `🌍 ${places[0].place.name}${places[0].place.country ? ` (${places[0].place.country})` : ""} — цаг агаар`
      : `🌍 «${input.tripTitle.trim()}» — цаг агаар`,
  );

  for (const report of places) {
    lines.push("");
    if (!single) lines.push(`📍 ${report.place.name}`);

    const current = currentLine(report, single);
    if (current) lines.push(current);

    const departureDay = nextDeparture ? report.daily.find((d) => d.date === nextDeparture) : undefined;
    if (departureDay) {
      lines.push(
        `Аялал эхлэх ${shortDate(departureDay.date)} (${weekdayShort(departureDay.date)}): ${weatherEmoji(departureDay.symbol)} ${deg(departureDay.hi)} / ${deg(departureDay.lo)}, ${weatherLabel(departureDay.symbol).toLowerCase()}`,
      );
    }

    // The day-by-day outlook only matters when the trip is close; for a trip
    // months away it is noise next to the travel-month normals.
    const soon = !nextDeparture || report.daily.some((d) => d.date >= nextDeparture);
    if (single && soon && report.daily.length) {
      const days = report.daily.slice(0, 5).map((d) => {
        const rain = d.precipMm >= 1 ? `, ☔ ${Math.round(d.precipMm)} мм` : "";
        return `• ${weekdayShort(d.date)} ${shortDate(d.date)} — ${weatherEmoji(d.symbol)} ${deg(d.hi)} / ${deg(d.lo)}${rain}`;
      });
      lines.push("Ойрын өдрүүд:", ...days);
    }

    const month = report.climate?.months[monthIndex];
    if (month) lines.push(`🗓 ${climateLine(month, monthIndex)}`);
  }

  // One packing tip for the whole trip, from the warmest high and coldest low
  // across its stops in the travel month.
  const monthNormals = places
    .map((p) => p.climate?.months[monthIndex])
    .filter((m): m is ClimateMonth => Boolean(m));
  if (monthNormals.length) {
    const combined: ClimateMonth = {
      hi: Math.max(...monthNormals.map((m) => m.hi)),
      lo: Math.min(...monthNormals.map((m) => m.lo)),
      rainDays: Math.max(...monthNormals.map((m) => m.rainDays)),
      cloud: null,
    };
    lines.push("", `👕 Авч явах: ${packingTip(combined)}.`);
  }

  if (nextDeparture && !places.some((p) => p.daily.some((d) => d.date >= nextDeparture))) {
    lines.push(
      "",
      `ℹ️ Аялал ${shortDate(nextDeparture)}-нд эхэлнэ — нарийн урьдчилсан мэдээ ойролцоогоор 9 хоногийн өмнөөс гарна, одоогоор олон жилийн дундаж үзүүлэлтийг харуулав.`,
    );
  }

  return lines.join("\n");
}
