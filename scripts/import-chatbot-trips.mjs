/**
 * Import UUDAM chatbot travel rows into the booking website catalog.
 *
 * Usage:
 *   node scripts/import-chatbot-trips.mjs `
 *     --json C:\Users\ganbo\Downloads\uudam-trips-2026-07-31.json `
 *     --chatbot-dir C:\Dev\Nexon-nova-company\clients-chatbot\Uudam-travel-brand\uudam-travel-chatbot
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const DEFAULT_JSON = "C:/Users/ganbo/Downloads/uudam-trips-2026-07-31.json";
const DEFAULT_CHATBOT_DIR =
  "C:/Dev/Nexon-nova-company/clients-chatbot/Uudam-travel-brand/uudam-travel-chatbot";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg.startsWith("--")) {
    const next = process.argv[i + 1];
    args.set(arg.slice(2), next && !next.startsWith("--") ? next : "true");
    if (next && !next.startsWith("--")) i += 1;
  }
}

const jsonPath = args.get("json") || DEFAULT_JSON;
const chatbotDir = args.get("chatbot-dir") || DEFAULT_CHATBOT_DIR;
const archiveDemo = args.get("archive-demo") !== "false";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));

const DESTINATIONS = [
  { matches: ["Шанхай"], key: "Shanghai", label: "Шанхай", queries: ["shanghai skyline", "shanghai china"] },
  { matches: ["Ханжоу"], key: "Hangzhou", label: "Ханжоу", queries: ["hangzhou west lake", "hangzhou china"] },
  { matches: ["Бэйдайхэ", "БЭЙДАЙХЭ"], key: "Beidaihe", label: "Бэйдайхэ", queries: ["beidaihe beach", "beidaihe china"] },
  { matches: ["Бээжин", "БЭЭЖИН"], key: "Beijing", label: "Бээжин", queries: ["beijing forbidden city", "great wall of china beijing"] },
  { matches: ["Датон"], key: "Datong", label: "Датон", queries: ["datong china", "datong yungang grottoes"] },
  { matches: ["Утай"], key: "Wutai Mountain", label: "Утай", queries: ["wutai mountain china"] },
  { matches: ["Жинин"], key: "Jining", label: "Жинин", queries: ["jining china"] },
  { matches: ["Хөх хот"], key: "Hohhot", label: "Хөх хот", queries: ["hohhot inner mongolia"] },
  { matches: ["Тэнгэрийн хаалга"], key: "Tianmen Mountain", label: "Тэнгэрийн хаалга", queries: ["zhangjiajie tianmen mountain"] },
  { matches: ["Чунчин"], key: "Chongqing", label: "Чунчин", queries: ["chongqing skyline", "chongqing china"] },
  { matches: ["Хайлаар"], key: "Hailar", label: "Хайлаар", queries: ["hailaer grassland", "hulunbuir grassland"] },
  { matches: ["Манжуур"], key: "Manzhouli", label: "Манжуур", queries: ["manzhouli china"] },
  { matches: ["Жанжакоу"], key: "Zhangjiakou", label: "Жанжакоу", queries: ["zhangjiakou china"] },
  { matches: ["Эрээн"], key: "Erenhot", label: "Эрээн", queries: ["erenhot inner mongolia"] },
  { matches: ["Чичихар"], key: "Qiqihar", label: "Чичихар", queries: ["qiqihar china"] },
  { matches: ["Далянь"], key: "Dalian", label: "Далянь", queries: ["dalian coast", "dalian china"] },
  { matches: ["Токио"], key: "Tokyo", label: "Токио", queries: ["tokyo skyline", "tokyo japan"] },
  { matches: ["Фүжи"], key: "Mount Fuji", label: "Фүжи", queries: ["mount fuji japan"] },
  { matches: ["Тяньжин"], key: "Tianjin", label: "Тяньжин", queries: ["tianjin china"] },
  { matches: ["Чежү", "Жэжү"], key: "Jeju", label: "Жэжү", queries: ["jeju island", "jeju coast"] },
  { matches: ["Пусан"], key: "Busan", label: "Пусан", queries: ["busan korea", "busan coast"] },
  { matches: ["Хайнан"], key: "Hainan", label: "Хайнан", queries: ["hainan beach", "hainan island"] },
  { matches: ["Саньяа"], key: "Sanya", label: "Саньяа", queries: ["sanya beach", "sanya china"] },
  { matches: ["Хайкоу"], key: "Haikou", label: "Хайкоу", queries: ["haikou china"] },
  { matches: ["Ордос"], key: "Ordos", label: "Ордос", queries: ["ordos china", "inner mongolia city"] },
  { matches: ["Гүмбэн"], key: "Kumbum Monastery", label: "Гүмбэн", queries: ["kumbum monastery"] },
  { matches: ["Макао"], key: "Macau", label: "Макао", queries: ["macau skyline", "macau city"] },
  { matches: ["Жухай"], key: "Zhuhai", label: "Жухай", queries: ["zhuhai china", "zhuhai coast"] },
  { matches: ["Хайлин"], key: "Hailing Island", label: "Хайлин арал", queries: ["hailing island china"] },
  { matches: ["Гуанжоу"], key: "Guangzhou", label: "Гуанжоу", queries: ["guangzhou skyline", "guangzhou china"] },
  { matches: ["Шэнжин"], key: "Shenzhen", label: "Шэнжин", queries: ["shenzhen skyline", "shenzhen china"] },
];

const LOCATION_LABELS = Object.fromEntries(DESTINATIONS.map((item) => [item.key, item.label]));
const LOCATION_QUERIES = Object.fromEntries(DESTINATIONS.map((item) => [item.key, item.queries]));

const IMAGE_LIBRARY = {
  Beijing: [
    "https://images.unsplash.com/photo-1719382810007-ccfe2238a58b?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1600&q=80",
  ],
  Shanghai: [
    "https://images.unsplash.com/photo-1718427778421-ad719f965738?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1538428494232-9c0d8a3ab403?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1545893835-abaa50cbe628?auto=format&fit=crop&w=1600&q=80",
  ],
  "Tianmen Mountain": [
    "https://images.unsplash.com/photo-1743526885034-b2f9331113c3?auto=format&fit=crop&w=1600&q=80",
  ],
  Chongqing: [
    "https://images.unsplash.com/photo-1601021200156-7f61433330d5?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=80",
  ],
  Hainan: [
    "https://images.unsplash.com/photo-1601819625452-4de4f0eef21b?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1599975225934-a60267556759?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
  ],
  Sanya: [
    "https://images.unsplash.com/photo-1683184778326-7e8460792126?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1601819625452-4de4f0eef21b?auto=format&fit=crop&w=1600&q=80",
  ],
  Haikou: [
    "https://images.unsplash.com/photo-1599975225934-a60267556759?auto=format&fit=crop&w=1600&q=80",
  ],
  Beidaihe: [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
  ],
  Datong: [
    "https://images.unsplash.com/photo-1719382810007-ccfe2238a58b?auto=format&fit=crop&w=1600&q=80",
  ],
  "Wutai Mountain": [
    "https://images.unsplash.com/photo-1743526885034-b2f9331113c3?auto=format&fit=crop&w=1600&q=80",
  ],
  Jining: [
    "https://images.unsplash.com/photo-1719382810007-ccfe2238a58b?auto=format&fit=crop&w=1600&q=80",
  ],
  Hohhot: [
    "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1600&q=80",
  ],
  Hailar: [
    "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1600&q=80",
  ],
  Manzhouli: [
    "https://images.unsplash.com/photo-1545893835-abaa50cbe628?auto=format&fit=crop&w=1600&q=80",
  ],
  Zhangjiakou: [
    "https://images.unsplash.com/photo-1719382810007-ccfe2238a58b?auto=format&fit=crop&w=1600&q=80",
  ],
  Erenhot: [
    "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1600&q=80",
  ],
  Qiqihar: [
    "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1600&q=80",
  ],
  Dalian: [
    "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=1600&q=80",
  ],
  Tokyo: [
    "https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1600&q=80",
  ],
  "Mount Fuji": [
    "https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?auto=format&fit=crop&w=1600&q=80",
  ],
  Jeju: [
    "https://images.unsplash.com/photo-1730898652585-bda492ae1b41?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1600&q=80",
  ],
  Busan: [
    "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1600&q=80",
  ],
  Tianjin: [
    "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=1600&q=80",
  ],
  Cruise: [
    "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=1600&q=80",
  ],
  Macau: [
    "https://images.unsplash.com/photo-1730036758748-79eac8fa8eb8?auto=format&fit=crop&w=1600&q=80",
  ],
  Zhuhai: [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
  ],
  "Hailing Island": [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
  ],
  Guangzhou: [
    "https://images.unsplash.com/photo-1718427778421-ad719f965738?auto=format&fit=crop&w=1600&q=80",
  ],
  Shenzhen: [
    "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=80",
  ],
  Default: [
    "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
  ],
};

const UNSPLASH_QUERY_CACHE = new Map();

const DEMO_SLUGS = [
  "yapon-sakura-7-honog",
  "solongos-seoul-jeju-5-honog",
  "govi-gurvan-saihan-4-honog",
  "turk-istanbul-kapadok-8-honog",
];

function compact(value) {
  return typeof value === "string" ? value.trim() : "";
}

function array(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function uniq(values) {
  return [...new Set(values.map(compact).filter(Boolean))];
}

const CYRILLIC_MAP = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", ө: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ү: "u", ф: "f", х: "h", ц: "ts", ч: "ch",
  ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(input, fallback = "trip") {
  const transliterated = compact(input)
    .toLowerCase()
    .split("")
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join("");
  const slug = transliterated
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || `${fallback}-${Date.now()}`;
}

function parseDuration(text) {
  const value = compact(text);
  const day = value.match(/(\d+)\s*(?:өдөр|хоног)/i);
  const night = value.match(/(\d+)\s*шөнө/i);
  const days = day ? Number(day[1]) : night ? Number(night[1]) + 1 : 1;
  const nights = night ? Number(night[1]) : Math.max(days - 1, 0);
  return { days, nights };
}

function displayLocation(location) {
  return LOCATION_LABELS[location] || compact(location);
}

function hashString(value) {
  return compact(value)
    .split("")
    .reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) >>> 0, 7);
}

function normalizeUnsplashUrl(url) {
  const match = compact(url).match(/https:\/\/images\.unsplash\.com\/photo-[^?&"]+/);
  if (!match) return "";
  return `${match[0]}?auto=format&fit=crop&w=1600&q=80`;
}

async function fetchUnsplashQueryImages(query) {
  const cacheKey = compact(query).toLowerCase();
  if (!cacheKey) return [];
  if (UNSPLASH_QUERY_CACHE.has(cacheKey)) return UNSPLASH_QUERY_CACHE.get(cacheKey);

  try {
    const slug = encodeURIComponent(cacheKey).replace(/%20/g, "-");
    const response = await fetch(`https://unsplash.com/s/photos/${slug}`);
    if (!response.ok) {
      UNSPLASH_QUERY_CACHE.set(cacheKey, []);
      return [];
    }

    const html = await response.text();
    const matches = [...html.matchAll(/https:\/\/images\.unsplash\.com\/photo-[^"&)]+/g)]
      .map((match) => normalizeUnsplashUrl(match[0]))
      .filter(Boolean);
    const unique = uniq(matches).slice(0, 60);
    UNSPLASH_QUERY_CACHE.set(cacheKey, unique);
    return unique;
  } catch {
    UNSPLASH_QUERY_CACHE.set(cacheKey, []);
    return [];
  }
}

async function loadLocationImages(location) {
  const queries = LOCATION_QUERIES[location] || [location];
  const fetched = [];

  for (const query of queries) {
    fetched.push(...(await fetchUnsplashQueryImages(query)));
    if (fetched.length >= 60) break;
  }

  const merged = uniq([...(IMAGE_LIBRARY[location] || []), ...fetched]);
  if (merged.length) IMAGE_LIBRARY[location] = merged;
  return merged;
}

function inferDestinations(trip) {
  const haystack = `${trip.route_name || ""} ${trip.source_description || ""} ${array(trip.important_notes).join(" ")}`;
  const found = [];
  for (const destination of DESTINATIONS) {
    if (destination.matches.some((needle) => haystack.toLowerCase().includes(needle.toLowerCase()))) {
      found.push(destination.key);
    }
  }
  return uniq(found);
}

function inferCountry(destinations) {
  if (destinations.some((d) => ["Tokyo", "Mount Fuji"].includes(d))) return "Япон";
  if (destinations.some((d) => ["Jeju", "Busan"].includes(d)) && destinations.every((d) => ["Jeju", "Busan"].includes(d))) {
    return "Өмнөд Солонгос";
  }
  if (destinations.some((d) => ["Jeju", "Busan"].includes(d))) return "БНХАУ / Өмнөд Солонгос";
  return "БНХАУ";
}

async function scenicImages(destinations, title) {
  const images = [];
  for (const destination of destinations) images.push(...(await loadLocationImages(destination)));
  if (/усан онгоц|круз/i.test(title)) images.push(...IMAGE_LIBRARY.Cruise);
  if (/хайнан|саньяа|хайкоу/i.test(title)) images.push(...(await loadLocationImages("Hainan")));
  if (/токио|фүжи/i.test(title)) images.push(...(await loadLocationImages("Tokyo")));
  if (/жэжү|чежү/i.test(title)) images.push(...(await loadLocationImages("Jeju")));
  return uniq(images.length ? images : IMAGE_LIBRARY.Default);
}

function imageForLocation(location, fallbackImages, index, seed = 0) {
  const preferred = IMAGE_LIBRARY[location] || [];
  if (preferred.length) return preferred[(seed + index) % preferred.length];

  const fallback = uniq([...fallbackImages, ...IMAGE_LIBRARY.Default]);
  return fallback[(seed + index) % fallback.length] || null;
}

function locationForDay(index, totalDays, locations) {
  if (locations.length === 0) return "";
  if (index === totalDays - 1) return locations[locations.length - 1];
  return locations[index % locations.length];
}

function titleForDay(index, totalDays, locations, location) {
  const current = displayLocation(location);
  if (index === 0) return `Улаанбаатар → ${current}`;
  if (index === totalDays - 1) return `${current} → Улаанбаатар`;

  const previous = displayLocation(locations[(index - 1) % locations.length]);
  if (previous && previous !== current && index < locations.length) return `${previous} → ${current}`;

  return `${current} дахь хөтөлбөр`;
}

function descriptionForDay(index, totalDays, highlights) {
  if (index === 0) {
    return "Нисэх буудал/хилийн боомтоос угтан авч, аяллын хөтөлбөр эхэлнэ.";
  }
  if (index === totalDays - 1) {
    return "Өглөөний цайны дараа буцах хөдөлгөөнд орно.";
  }

  const highlight = highlights[(index - 1) % highlights.length];
  return highlight
    ? `${highlight} болон тухайн өдрийн аяллын хөтөлбөр.`
    : "Хотын үзвэр, чөлөөт цаг болон хөтөлбөрт багтсан хэсгүүд.";
}

function inferTransport(trip) {
  const text = `${trip.category || ""} ${trip.route_name || ""}`.toLowerCase();
  if (text.includes("круз") || text.includes("усан онгоц")) return ["Усан онгоц", "Автобус"];
  if (text.includes("хосолсон")) return ["Галт тэрэг", "Онгоц", "Автобус"];
  if (text.includes("газрын")) return ["Автобус", "Галт тэрэг"];
  if (text.includes("шууд нислэг")) return ["Онгоц", "Автобус"];
  return ["Автобус"];
}

function formatMoney(amount, currency = "MNT") {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "";
  return `${amount.toLocaleString("mn-MN")}${currency === "MNT" ? "₮" : ` ${currency}`}`;
}

function formatExtraFee(fee) {
  const label = compact(fee?.label) || "Нэмэлт төлбөр";
  const amount = formatMoney(fee?.amount, compact(fee?.currency) || "MNT");
  const applies = compact(fee?.applies_to);
  const note = compact(fee?.note);
  return [label, amount, applies && `(${applies})`, note && `- ${note}`].filter(Boolean).join(" ");
}

function formatRoomPrice(room) {
  return [compact(room?.room_type) || "Өрөө", formatMoney(room?.price, compact(room?.currency) || "MNT"), compact(room?.note)]
    .filter(Boolean)
    .join(" - ");
}

function formatChildRule(rule) {
  return [
    compact(rule?.label) || "Хүүхэд",
    compact(rule?.age_range),
    formatMoney(rule?.price, compact(rule?.currency) || "MNT"),
    compact(rule?.note),
  ]
    .filter(Boolean)
    .join(" - ");
}

function extractHighlights(trip, destinations) {
  const notes = array(trip.important_notes);
  const title = compact(trip.route_name);
  const highlights = destinations.map(displayLocation);
  if (/усан парк|Water World/i.test(`${title} ${notes.join(" ")}`)) highlights.push("Усан парк");
  if (/дисней/i.test(`${title} ${notes.join(" ")}`)) highlights.push("Шанхайн Диснейлэнд");
  if (/атлантис/i.test(`${title} ${notes.join(" ")}`)) highlights.push("Атлантис усан парк");
  if (/далайн аквариум/i.test(notes.join(" "))) highlights.push("Далайн аквариум");
  if (/мини аватар/i.test(`${title} ${notes.join(" ")}`)) highlights.push("Мини Аватар");
  if (/шилэн гүүр/i.test(notes.join(" "))) highlights.push("Шилэн гүүр");
  if (/завьтай аялал/i.test(notes.join(" "))) highlights.push("Завьтай аялал");
  return uniq([...highlights, ...notes.map((note) => note.split(".")[0]).filter((note) => note.length < 140)]).slice(0, 10);
}

function derivePrice(trip) {
  if (typeof trip.adult_price === "number") return trip.adult_price;
  const roomPrices = Array.isArray(trip.room_prices) ? trip.room_prices : [];
  const roomPrice = roomPrices
    .map((room) => room?.price)
    .filter((price) => typeof price === "number")
    .sort((a, b) => a - b)[0];
  if (typeof roomPrice === "number") return roomPrice;
  const groupPrices = Array.isArray(trip.price_groups) ? trip.price_groups : [];
  const groupPrice = groupPrices
    .map((group) => group?.adult_price)
    .filter((price) => typeof price === "number")
    .sort((a, b) => a - b)[0];
  return typeof groupPrice === "number" ? groupPrice : 1;
}

function buildDescription(trip, destinations) {
  const route = destinations.map(displayLocation);
  const parts = [
    compact(trip.source_description),
    route.length ? `Маршрут: ${route.join(" → ")}.` : "",
    compact(trip.notes),
  ];
  return parts.filter(Boolean).join("\n\n") || compact(trip.route_name);
}

function buildRequirements(trip) {
  const lines = [];
  if (array(trip.review_reasons).length) lines.push(`Шалгах шаардлагатай: ${array(trip.review_reasons).join("; ")}`);
  return lines.join("\n") || undefined;
}

function buildItinerary(trip, destinations, images) {
  const { days } = parseDuration(trip.duration_text);
  const highlights = extractHighlights(trip, destinations);
  const locations = destinations.length ? destinations : [compact(trip.route_name)];
  return Array.from({ length: Math.min(days, 30) }, (_, index) => {
    const dayNumber = index + 1;
    const locationKey = locationForDay(index, days, locations);
    const title = titleForDay(index, days, locations, locationKey);
    const description = descriptionForDay(index, days, highlights);
    return {
      dayNumber,
      title,
      description,
      location: displayLocation(locationKey),
      meals: trip.has_food === true || array(trip.included_items).some((item) => /хоол|цай/i.test(item))
        ? ["Өглөөний цай"]
        : [],
      accommodation: compact(trip.hotel) || null,
      image: images[index] || null,
    };
  });
}

function normalizeDepartureText(values) {
  const out = [];
  let lastMonth = null;
  for (const raw of array(values)) {
    const value = raw.replace(/\s*·\s*/g, " ").trim();
    const full = value.match(/(?:(\d{4})\s*он\s*)?(\d{1,2})\s*сарын\s*(\d{1,2})/i);
    if (full) {
      lastMonth = Number(full[2]);
      out.push(value);
      continue;
    }
    if (/^\d{1,2}$/.test(value) && lastMonth) {
      out.push(`${lastMonth} сарын ${value}`);
      continue;
    }
    out.push(value);
  }
  return out;
}

function parseDepartureDate(text) {
  const normalized = compact(text);
  const match = normalized.match(/(?:(\d{4})\s*он\s*)?(\d{1,2})\s*сарын\s*(\d{1,2})/i);
  if (!match) return null;
  const now = new Date();
  const month = Number(match[2]);
  const day = Number(match[3]);
  let year = match[1] ? Number(match[1]) : now.getFullYear();
  let date = new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
  if (!match[1] && date.getTime() < Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) {
    year += 1;
    date = new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
  }
  return date;
}

function buildDepartures(trip, durationDays) {
  return normalizeDepartureText(trip.departure_dates)
    .map((dateText) => {
      const startDate = parseDepartureDate(dateText);
      if (!startDate) return null;
      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + Math.max(durationDays - 1, 0));
      const seatsFromText = dateText.match(/(\d+)\s*суудал/i);
      return {
        label: dateText,
        startDate,
        endDate,
        seatsTotal: typeof trip.seats_total === "number" ? trip.seats_total : null,
        seatsLeft: seatsFromText ? Number(seatsFromText[1]) : (typeof trip.seats_left === "number" ? trip.seats_left : null),
        price: typeof trip.adult_price === "number" ? trip.adult_price : null,
        childPrice: typeof trip.child_price === "number" ? trip.child_price : null,
        infantPrice: null,
        status: trip.status === "sold_out" ? "SOLD_OUT" : "OPEN",
      };
    })
    .filter(Boolean);
}

function buildTags(trip) {
  const text = `${trip.category || ""} ${trip.route_name || ""} ${array(trip.important_notes).join(" ")}`.toLowerCase();
  const tags = [];
  if (text.includes("шууд нислэг")) tags.push("Шууд нислэг");
  if (text.includes("газрын")) tags.push("Газрын аялал");
  if (text.includes("хосолсон")) tags.push("Газар + нислэг");
  if (text.includes("усан парк")) tags.push("Усан парк");
  if (text.includes("шинжилгээ")) tags.push("Шинжилгээтэй");
  if (text.includes("круз") || text.includes("усан онгоц")) tags.push("Круз");
  if (Array.isArray(trip.discounts) && trip.discounts.some((d) => typeof d?.adult_price === "number")) tags.push("Хямдралтай");
  return uniq(tags);
}

async function loadJsonTrips(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.trips) ? parsed.trips : [];
}

async function loadChatbotTrips() {
  if (!fs.existsSync(chatbotDir)) return [];
  loadEnvFile(path.join(chatbotDir, ".env"));
  loadEnvFile(path.join(chatbotDir, ".env.local"));
  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) return [];

  const chatbotRequire = createRequire(path.join(chatbotDir, "package.json"));
  const { Client } = chatbotRequire("pg");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const result = await client.query(`
    SELECT
      id, category, operator_name, route_name, duration_text, adult_price,
      child_price, currency, departure_dates, seats_total, seats_left,
      has_food, status, notes, hotel, source_description, photo_urls, extra,
      created_at, updated_at
    FROM travel_trip_entries
    ORDER BY updated_at DESC, created_at DESC
  `);
  await client.end();

  return result.rows.map((row) => {
    const extra = row.extra && typeof row.extra === "object" ? row.extra : {};
    return {
      ...row,
      photo_urls: Array.isArray(row.photo_urls) ? row.photo_urls : [],
      aliases: array(extra.aliases),
      price_groups: Array.isArray(extra.price_groups) ? extra.price_groups : [],
      discounts: Array.isArray(extra.discounts) ? extra.discounts : [],
      child_rules: Array.isArray(extra.child_rules) ? extra.child_rules : [],
      extra_fees: Array.isArray(extra.extra_fees) ? extra.extra_fees : [],
      departure_rule: compact(extra.departure_rule),
      included_items: array(extra.included_items),
      excluded_items: array(extra.excluded_items),
      room_prices: Array.isArray(extra.room_prices) ? extra.room_prices : [],
      important_notes: array(extra.important_notes),
      brochure_pdf_url: compact(extra.brochure_pdf_url),
      customer_visible: typeof extra.customer_visible === "boolean" ? extra.customer_visible : true,
      needs_human_review: Boolean(extra.needs_human_review),
      review_reasons: array(extra.review_reasons),
      sourceMetadata: extra,
    };
  });
}

function mergeTrips(jsonTrips, dbTrips) {
  const byKey = new Map();
  for (const trip of jsonTrips) byKey.set(trip.id || trip.route_name, trip);
  for (const trip of dbTrips) {
    const key = trip.id || trip.route_name;
    byKey.set(key, { ...(byKey.get(key) || {}), ...trip });
  }
  return [...byKey.values()].filter((trip) => compact(trip.route_name));
}

async function ensureCategory(prisma, name) {
  const categoryName = compact(name) || "Ерөнхий аялал";
  const slug = slugify(categoryName, "category");
  return prisma.category.upsert({
    where: { slug },
    update: { categoryName },
    create: { categoryName, slug },
  });
}

async function ensureTags(prisma, names) {
  const tags = [];
  for (const name of names) {
    const slug = slugify(name, "tag");
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
    tags.push(tag);
  }
  return tags;
}

async function uniqueSlug(prisma, base, sourceTripId) {
  let candidate = base;
  let counter = 2;
  for (;;) {
    const existing = await prisma.trip.findUnique({
      where: { slug: candidate },
      select: { id: true, sourceTripId: true },
    });
    if (!existing || existing.sourceTripId === sourceTripId) return candidate;
    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

async function enforceUniquePublishedImages(prisma) {
  const trips = await prisma.trip.findMany({
    where: { sourceTripId: { not: null }, isPublished: true },
    select: {
      id: true,
      image: true,
      extraImages: true,
      itinerary: { select: { id: true, image: true } },
    },
  });

  const occurrencesByImage = new Map();
  for (const trip of trips) {
    const cover = compact(trip.image);
    if (cover) {
      if (!occurrencesByImage.has(cover)) occurrencesByImage.set(cover, []);
      occurrencesByImage.get(cover).push({ tripId: trip.id, kind: "cover" });
    }

    for (const image of trip.extraImages) {
      const value = compact(image);
      if (!value) continue;
      if (!occurrencesByImage.has(value)) occurrencesByImage.set(value, []);
      occurrencesByImage.get(value).push({ tripId: trip.id, kind: "extra" });
    }

    for (const day of trip.itinerary) {
      const value = compact(day.image);
      if (!value) continue;
      if (!occurrencesByImage.has(value)) occurrencesByImage.set(value, []);
      occurrencesByImage.get(value).push({ tripId: trip.id, kind: "itinerary", itineraryId: day.id });
    }
  }

  const extraRemovals = new Map();
  const itineraryNulls = new Set();
  const priority = { cover: 0, extra: 1, itinerary: 2 };

  for (const [image, occurrences] of occurrencesByImage.entries()) {
    if (occurrences.length < 2) continue;
    const ordered = [...occurrences].sort((a, b) => priority[a.kind] - priority[b.kind]);
    for (const occurrence of ordered.slice(1)) {
      if (occurrence.kind === "extra") {
        if (!extraRemovals.has(occurrence.tripId)) extraRemovals.set(occurrence.tripId, new Set());
        extraRemovals.get(occurrence.tripId).add(image);
      } else if (occurrence.kind === "itinerary") {
        itineraryNulls.add(occurrence.itineraryId);
      }
    }
  }

  for (const trip of trips) {
    const removals = extraRemovals.get(trip.id);
    if (!removals?.size) continue;
    const nextExtraImages = trip.extraImages.filter((image) => !removals.has(image));
    await prisma.trip.update({
      where: { id: trip.id },
      data: { extraImages: nextExtraImages },
    });
  }

  for (const itineraryId of itineraryNulls) {
    await prisma.itineraryDay.update({
      where: { id: itineraryId },
      data: { image: null },
    });
  }
}

function pickCoverImage(images, seedText) {
  if (!images.length) return IMAGE_LIBRARY.Default[0];
  return images[hashString(seedText) % images.length];
}

function rotateCandidates(images, seedText) {
  const candidates = uniq(images);
  if (candidates.length < 2) return candidates;
  const offset = hashString(seedText) % candidates.length;
  return [...candidates.slice(offset), ...candidates.slice(0, offset)];
}

function pickUnusedImage(images, globalUsedImages, tripUsedImages, seedText) {
  for (const image of rotateCandidates(images, seedText)) {
    if (!globalUsedImages.has(image) && !tripUsedImages.has(image)) {
      globalUsedImages.add(image);
      tripUsedImages.add(image);
      return image;
    }
  }
  return null;
}

function pickUnusedImages(images, globalUsedImages, tripUsedImages, seedText, limit) {
  const chosen = [];
  for (const image of rotateCandidates(images, seedText)) {
    if (chosen.length >= limit) break;
    if (globalUsedImages.has(image) || tripUsedImages.has(image)) continue;
    globalUsedImages.add(image);
    tripUsedImages.add(image);
    chosen.push(image);
  }
  return chosen;
}

async function toTripData(trip, categoryId, tags, globalUsedImages) {
  const title = compact(trip.route_name);
  const destinations = inferDestinations(trip);
  const country = inferCountry(destinations);
  const { days, nights } = parseDuration(trip.duration_text);
  const scenic = await scenicImages(destinations, title);
  const posterPhotos = array(trip.photo_urls);
  const tripUsedImages = new Set();
  const tripSeed = trip.id || title;
  const locationKeys = destinations.length ? destinations : [compact(trip.route_name)];
  const imageCandidates = uniq([...scenic, ...posterPhotos, ...IMAGE_LIBRARY.Default]);
  const coverImage =
    pickUnusedImage(scenic, globalUsedImages, tripUsedImages, `${tripSeed}:cover`) ||
    pickUnusedImage(imageCandidates, globalUsedImages, tripUsedImages, `${tripSeed}:cover:fallback`) ||
    pickCoverImage(scenic, tripSeed);
  const included = uniq(array(trip.included_items));
  const excluded = uniq(array(trip.excluded_items));
  const importantNotes = uniq(array(trip.important_notes));
  const extraFees = Array.isArray(trip.extra_fees) ? uniq(trip.extra_fees.map(formatExtraFee)) : [];
  const roomPrices = Array.isArray(trip.room_prices) ? uniq(trip.room_prices.map(formatRoomPrice)) : [];
  const childPriceNotes = Array.isArray(trip.child_rules) ? uniq(trip.child_rules.map(formatChildRule)) : [];
  const price = derivePrice(trip);
  const singleSupplementText = extraFees.find((fee) => fee.includes("ганцаараа"));
  const singleSupplementMatch = singleSupplementText?.match(/([\d,]+)₮/);
  const localizedDestinations = destinations.map(displayLocation);
  const itineraryImageCount = Math.min(days, 30);
  const itineraryImages = Array.from({ length: itineraryImageCount }, (_, index) => {
    const locationKey = locationForDay(index, days, locationKeys);
    const locationCandidates = uniq([...(IMAGE_LIBRARY[locationKey] || []), ...imageCandidates]);
    return (
      pickUnusedImage(locationCandidates, globalUsedImages, tripUsedImages, `${tripSeed}:day:${index}:${locationKey}`) ||
      pickUnusedImage(imageCandidates, globalUsedImages, tripUsedImages, `${tripSeed}:day:${index}:fallback`)
    );
  });
  const galleryImages = pickUnusedImages(
    imageCandidates,
    globalUsedImages,
    tripUsedImages,
    `${tripSeed}:gallery`,
    8,
  );

  return {
    title,
    summary: compact(trip.source_description).slice(0, 400) || `${title} - ${days} өдөр ${nights} шөнө.`,
    description: buildDescription(trip, destinations),
    country,
    city: localizedDestinations[0] || null,
    region: country.includes("БНХАУ") ? "Ази" : null,
    destinations: localizedDestinations,
    durationDays: days,
    durationNights: nights,
    minTravelers: 1,
    maxTravelers: null,
    difficulty: "EASY",
    transport: inferTransport(trip),
    languages: ["Монгол"],
    season: "Зун",
    highlights: extractHighlights(trip, destinations),
    included,
    excluded,
    requirements: buildRequirements(trip) || null,
    cancellationPolicy: null,
    importantNotes,
    image: coverImage,
    extraImages: galleryImages,
    video: null,
    videos: [],
    price,
    oldPrice: null,
    discount: 0,
    childPrice: typeof trip.child_price === "number" ? trip.child_price : null,
    infantPrice: null,
    singleSupplement: singleSupplementMatch ? Number(singleSupplementMatch[1].replace(/,/g, "")) : null,
    currency: compact(trip.currency) || "MNT",
    sourceTripId: trip.id,
    sourceMetadata: {
      importedAt: new Date().toISOString(),
      route_name: trip.route_name,
      category: trip.category,
      status: trip.status,
      customer_visible: trip.customer_visible,
      duration_text: trip.duration_text,
      departure_dates: trip.departure_dates,
      photo_urls: trip.photo_urls,
      price_groups: trip.price_groups,
      discounts: trip.discounts,
      source_extra: trip.sourceMetadata || {},
    },
    hotel: compact(trip.hotel) || null,
    foodIncluded: typeof trip.has_food === "boolean" ? trip.has_food : (included.some((item) => /хоол|цай/i.test(item)) ? true : null),
    departureRule: compact(trip.departure_rule) || array(trip.departure_dates).filter((date) => !parseDepartureDate(date)).join(", ") || null,
    extraFees,
    roomPrices,
    childPriceNotes,
    brochurePdfUrl: compact(trip.brochure_pdf_url) || null,
    categoryId,
    isFeatured: posterPhotos.length > 0 || importantNotes.length > 0,
    isPublished: trip.status === "active" && trip.customer_visible !== false,
    itinerary: { create: buildItinerary(trip, destinations, itineraryImages, 0) },
    departures: { create: buildDepartures(trip, days) },
    tags: { connect: tags.map((tag) => ({ id: tag.id })) },
  };
}

async function main() {
  const prisma = new PrismaClient();
  const jsonTrips = await loadJsonTrips(jsonPath);
  const dbTrips = await loadChatbotTrips();
  const trips = mergeTrips(jsonTrips, dbTrips);

  if (trips.length === 0) {
    throw new Error("No source trips found. Check --json and --chatbot-dir.");
  }

  if (archiveDemo) {
    await prisma.trip.updateMany({
      where: { slug: { in: DEMO_SLUGS }, sourceTripId: null },
      data: { isPublished: false, isFeatured: false },
    });
  }

  let created = 0;
  let updated = 0;
  const imported = [];
  const usedImages = new Set();

  for (const sourceTrip of trips) {
    const category = await ensureCategory(prisma, sourceTrip.category);
    const tags = await ensureTags(prisma, buildTags(sourceTrip));
    const sourceTripId = compact(sourceTrip.id) || `chatbot-${slugify(sourceTrip.route_name)}`;
    const slug = await uniqueSlug(prisma, slugify(sourceTrip.route_name), sourceTripId);
    const data = await toTripData({ ...sourceTrip, id: sourceTripId }, category.id, tags, usedImages);

    const existing = await prisma.trip.findUnique({
      where: { sourceTripId },
      select: { id: true },
    });

    const saved = await prisma.$transaction(
      async (tx) => {
        if (existing) {
          await tx.itineraryDay.deleteMany({ where: { tripId: existing.id } });
          await tx.departure.deleteMany({ where: { tripId: existing.id } });
          return tx.trip.update({
            where: { id: existing.id },
            data: { ...data, slug, tags: { set: tags.map((tag) => ({ id: tag.id })) } },
            select: { id: true, title: true, extraImages: true },
          });
        }

        return tx.trip.create({
          data: { ...data, slug },
          select: { id: true, title: true, extraImages: true },
        });
      },
      { timeout: 30_000 },
    );

    existing ? (updated += 1) : (created += 1);
    imported.push({ title: saved.title, media: 1 + saved.extraImages.length });
  }

  await enforceUniquePublishedImages(prisma);

  console.log(JSON.stringify({
    source: {
      jsonTrips: jsonTrips.length,
      chatbotDbTrips: dbTrips.length,
      mergedTrips: trips.length,
      tripsWithChatbotPhotos: trips.filter((trip) => array(trip.photo_urls).length > 0).length,
    },
    result: { created, updated, imported },
  }, null, 2));

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
