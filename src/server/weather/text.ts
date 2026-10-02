import { roundTemp, shortDate, weatherEmoji, weekdayShort, type TripWeatherReport } from "@/lib/weather";

/**
 * The plain-text weather answer — built here, next to the data, and sent
 * verbatim by the Messenger bot (via /api/weather), so the chat and the
 * website card always say the same thing. One line per trip day, for the
 * place the traveller is in that day — never "today's weather somewhere".
 */

const deg = (value: number) => `${roundTemp(value)}°`;

/** Trip out of forecast reach: what it is like in its cities right now. */
function currentText(report: Omit<TripWeatherReport, "text">): string {
  const first = report.days[0].date;
  const last = report.days[report.days.length - 1].date;
  const lines: string[] = [`🌍 «${report.tripTitle.trim()}»`, "", "🌤 Очих хотуудад одоогоор:"];
  for (const entry of report.now) {
    const place = report.places[entry.place];
    const days = entry.days
      .slice(0, 3)
      .map((d) => `${weekdayShort(d.date)} ${weatherEmoji(d.symbol)} ${deg(d.hi)}/${deg(d.lo)}`)
      .join(" · ");
    lines.push(`📍 ${place.name}: ${days}`);
  }
  lines.push(
    "",
    `🗓 Таны аялал ${shortDate(first)}–${shortDate(last)}.` +
      (report.forecastFrom ? ` Тэр өдрүүдийн урьдчилсан мэдээ ${shortDate(report.forecastFrom)}-наас гарна.` : ""),
  );
  if (report.packing && report.usual) {
    lines.push(
      `👕 Аялах үед ихэвчлэн өдөртөө ${deg(report.usual.hi)}, шөнөдөө ${deg(report.usual.lo)} байдаг — авч явах: ${report.packing}.`,
    );
  }
  return lines.join("\n");
}

export function buildWeatherText(report: Omit<TripWeatherReport, "text">): string {
  if (report.mode === "current") return currentText(report);
  const shown = report.days.filter((d) => d.place !== null && d.hi !== null && d.lo !== null && d.symbol);
  if (!shown.length) return "";

  const first = report.days[0].date;
  const last = report.days[report.days.length - 1].date;
  const lines: string[] = [
    `🌍 «${report.tripTitle.trim()}»`,
    report.departure
      ? `🗓 ${shortDate(first)}–${shortDate(last)} аяллын үеийн цаг агаар`
      : "🗓 Ойрын өдрүүдийн цаг агаар (гарах огноо тодорхойгүй)",
    "",
  ];

  let lastPlace: number | null = null;
  for (const day of shown) {
    const place = report.places[day.place!];
    const where = day.place !== lastPlace ? ` · ${place.name}` : "";
    lastPlace = day.place;
    const rain =
      day.source === "forecast"
        ? (day.precipMm ?? 0) >= 1 ? `, ☔ ${Math.round(day.precipMm!)} мм` : ""
        : (day.rainChance ?? 0) >= 30 ? `, ☔ ${day.rainChance}%` : "";
    lines.push(
      `${day.day}-р өдөр ${weekdayShort(day.date)} ${shortDate(day.date)}${where}: ${weatherEmoji(day.symbol!)} ${deg(day.hi!)} / ${deg(day.lo!)}${rain}${day.source === "typical" ? " (ердийн)" : ""}`,
    );
  }

  if (report.packing) lines.push("", `👕 Авч явах: ${report.packing}.`);

  const typical = shown.some((d) => d.source === "typical");
  if (typical) {
    lines.push(
      "",
      report.forecastFrom
        ? `ℹ️ "(ердийн)" — тухайн өдрүүдийн олон жилийн дундаж. Бодит урьдчилсан мэдээ ${shortDate(report.forecastFrom)}-наас гарна.`
        : `ℹ️ "(ердийн)" — урьдчилсан мэдээ хүрэхгүй өдрүүдэд олон жилийн дундажийг харуулав.`,
    );
  }

  return lines.join("\n");
}
