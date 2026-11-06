/**
 * Where a trip goes, for browsing and search.
 *
 * Trips carry no structured place data — every published trip has an empty
 * country, city and destinations list — but their titles name the places:
 * "ТАЙЛАНД — ПУКЕТ АЯЛАЛ", "Япон Токио, Фүжи аялал". This reads those names
 * against the places the agency actually sells, so the catalogue can be
 * browsed by destination. Anything staff do type into country, city or
 * destinations is matched the same way and always counts.
 *
 * No imports on purpose: the tests load this file straight under Node.
 */

export type Destination = {
  key: string;
  label: string;
  country: string;
  /** Mongolian spellings and Latin names people type, folded (see `fold`). */
  terms: string[];
};

export const DESTINATIONS: Destination[] = [
  { key: "hainan", label: "Хайнан", country: "Хятад", terms: ["хайнан", "санья", "саня", "хайкоу", "hainan", "sanya", "haikou"] },
  { key: "thailand", label: "Тайланд", country: "Тайланд", terms: ["тайланд", "пукет", "пхукет", "бангкок", "паттаяа", "паттайя", "thailand", "phuket", "bangkok", "pattaya"] },
  // The agency's Great Wall visits are on its Beijing routes.
  { key: "beijing", label: "Бээжин", country: "Хятад", terms: ["бээжин", "цагаан хэрэм", "их хэрэм", "beijing", "great wall"] },
  { key: "shanghai", label: "Шанхай", country: "Хятад", terms: ["шанхай", "shanghai"] },
  { key: "inner-mongolia", label: "Өвөр Монгол", country: "Хятад", terms: ["хөх хот", "ордос", "жинин", "мини аватар", "өвөр монгол", "hohhot", "ordos", "inner mongolia"] },
  { key: "zhangjiajie", label: "Жанжиажэ", country: "Хятад", terms: ["жанжиажэ", "тэнгэрийн хаалга", "zhangjiajie", "tianmen"] },
  { key: "chongqing", label: "Чунчин", country: "Хятад", terms: ["чунчин", "chongqing"] },
  { key: "wutai", label: "Утай", country: "Хятад", terms: ["утай", "wutai"] },
  { key: "hong-kong-macau", label: "Хонконг · Макао", country: "Хятад", terms: ["хонконг", "макао", "шэньжэнь", "жухай", "hong kong", "macau", "shenzhen", "zhuhai"] },
  { key: "japan", label: "Япон", country: "Япон", terms: ["япон", "токио", "фүжи", "осака", "киото", "фүкүока", "japan", "tokyo", "fuji", "osaka", "kyoto", "fukuoka"] },
  { key: "korea", label: "Өмнөд Солонгос", country: "Өмнөд Солонгос", terms: ["солонгос", "сөүл", "чэжү", "пусан", "korea", "seoul", "jeju", "busan"] },
  // No Cyrillic "Фукуок": folded, "Фүкүока" (Fukuoka, Japan) starts with it.
  { key: "vietnam", label: "Вьетнам", country: "Вьетнам", terms: ["вьетнам", "дананг", "нячанг", "ханой", "vietnam", "danang", "da nang", "nha trang", "phu quoc", "hanoi"] },
  { key: "bali", label: "Бали", country: "Индонез", terms: ["бали", "bali", "indonesia"] },
  { key: "egypt", label: "Египет", country: "Египет", terms: ["египет", "каир", "хургада", "egypt", "cairo", "hurghada"] },
  { key: "turkey", label: "Турк", country: "Турк", terms: ["турк", "анталяа", "анталья", "истанбул", "памуккале", "каппадок", "turkey", "antalya", "istanbul", "pamukkale", "cappadocia"] },
];

/**
 * Case- and spelling-tolerant form for matching: lower case, Ө→о, Ү→у, Ё→е,
 * punctuation to spaces. People type "хох хот" for "Хөх хот" and "фужи" for
 * "Фүжи" on phones without the Mongolian letters.
 */
export function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/ө/g, "о")
    .replace(/ү/g, "у")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const FOLDED = DESTINATIONS.map((destination) => ({
  destination,
  terms: destination.terms.map(fold),
}));

type Placeable = {
  title: string;
  country?: string | null;
  city?: string | null;
  destinations?: string[] | null;
};

/**
 * "-аас/-ээс/-оос/-өөс" (from): "Хөх хотоос Таврин нислэгтэй" is a Hainan trip
 * that flies out of Hohhot, not a trip to Hohhot.
 */
const ORIGIN_SUFFIX = /^г?(оос|ээс|аас)$/;

/**
 * True when `text` names `term` as a place the trip goes to. Matches at the
 * start of a word so inflected forms count ("Тайландын", "Японы"), and skips
 * a word that only names where the trip leaves from.
 */
export function mentionsPlace(text: string, term: string): boolean {
  if (!term) return false;
  const padded = ` ${text} `;
  let index = padded.indexOf(` ${term}`);
  while (index !== -1) {
    const after = padded.slice(index + term.length + 1);
    const end = after.indexOf(" ");
    const rest = end === -1 ? after : after.slice(0, end);
    if (!ORIGIN_SUFFIX.test(rest)) return true;
    index = padded.indexOf(` ${term}`, index + 1);
  }
  return false;
}

/** The destinations a trip goes to, in the order of DESTINATIONS. */
export function tripDestinations(trip: Placeable): Destination[] {
  const text = fold([trip.title, trip.country, trip.city, ...(trip.destinations ?? [])].filter(Boolean).join(" "));
  return FOLDED.filter(({ terms }) => terms.some((term) => mentionsPlace(text, term))).map(({ destination }) => destination);
}

export function destinationByKey(key: string | null | undefined): Destination | null {
  return DESTINATIONS.find((destination) => destination.key === key) ?? null;
}

export type DestinationCount = { key: string; label: string; country: string; count: number };

/** Destinations present in a set of trips, most trips first. */
export function destinationCounts(trips: Placeable[]): DestinationCount[] {
  const counts = new Map<string, number>();
  for (const trip of trips) {
    for (const destination of tripDestinations(trip)) {
      counts.set(destination.key, (counts.get(destination.key) ?? 0) + 1);
    }
  }
  return DESTINATIONS.filter((destination) => counts.has(destination.key))
    .map((destination) => ({ key: destination.key, label: destination.label, country: destination.country, count: counts.get(destination.key) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "mn"));
}

/** Distinct countries a set of trips goes to. */
export function countryCount(trips: Placeable[]): number {
  return new Set(trips.flatMap((trip) => tripDestinations(trip).map((destination) => destination.country))).size;
}
