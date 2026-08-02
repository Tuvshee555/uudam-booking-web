import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

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

const prisma = new PrismaClient();

const SOURCE_TRIP_ID = "manual-isanpo-zhangchhuu-pdf-2026-08-02";
const TRIP_SLUG = "i-san-po-janchhuu-ayalal";
const BROCHURE_PATH = "C:/Users/ganbo/Downloads/И САНЬ ПО - ЖАНЧХҮҮ АЯЛАЛ (1).pdf";

const local = (name) => `/manual-trips/isanpo-zhangchhuu/${name}`;

const IMAGE_SET = {
  cover: local("cover-collage.jpg"),
  itinerary: [
    local("day1.jpg"),
    local("day2.jpg"),
    local("day3.jpg"),
    "https://images.unsplash.com/photo-1691217115292-f0a4e902aeb2?auto=format&fit=crop&w=1600&q=80",
  ],
  gallery: [
    local("day4.jpg"),
    "https://images.unsplash.com/photo-1743093263638-845bee7205c0?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1569396364521-0fad3682a389?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1669623313981-6af02eedb15c?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1714315501191-577ed612d503?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1640452581940-aaf860407b00?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1720421780068-90eee1321094?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1759910218506-a5dda5457e08?auto=format&fit=crop&w=1600&q=80",
  ],
};

const TRIP_DATA = {
  title: "И Сань По - Жанчхүү аялал",
  summary:
    "4 өдөр 3 шөнө. УБ → Замын-Үүд → Эрээн → И Сань По → Жанчхүү чиглэлтэй газрын аялал.",
  description: [
    "И Сань По, Жанчхүү чиглэлтэй 4 өдөр 3 шөнийн газрын аялал.",
    "Маршрут: УБ → Замын-Үүд → Эрээн → И Сань По → Жанчхүү → Эрээн → Замын-Үүд → УБ.",
    "Онцлох хэсгүүд: И Сань По байгалийн бүс, шилэн гүүр, хавцлын үзэмж, Жанчхүү хотын амралт, халуун рашааны хөтөлбөр.",
  ].join("\n\n"),
  country: "БНХАУ",
  city: "И Сань По",
  region: "Ази",
  destinations: ["Замын-Үүд", "Эрээн", "И Сань По", "Жанчхүү"],
  durationDays: 4,
  durationNights: 3,
  minTravelers: 1,
  difficulty: "EASY",
  transport: ["Галт тэрэг", "Автобус"],
  languages: ["Монгол"],
  season: "Зун",
  highlights: [
    "И Сань По байгалийн бүс",
    "Шилэн гүүр",
    "Хавцлын үзэмж",
    "Жанчхүү хот",
    "Халуун рашаан, амралтын хөтөлбөр",
  ],
  included: ["3 шөнийн байр", "Хөтөлбөрт дурдсан хоол", "Аяллын ахлагчтай"],
  excluded: ["Хөтөлбөрт дурдаагүй хувийн зардал"],
  importantNotes: [
    "Хамт олон, гэр бүлийн болон эрт захиалгын хөнгөлөлттэй.",
    "Захиалга, дэлгэрэнгүй мэдээлэл: 86185769",
  ],
  hotel: "Эрээн, И Сань По, Жанчхүү зочид буудал",
  brochurePdfUrl: null,
  categorySlug: "gazryn-ayalal",
  tagNames: ["Газрын аялал", "Шилэн гүүр", "Байгалийн аялал", "Халуун рашаан"],
  price: 850000,
  childPrice: null,
  currency: "MNT",
  departureDays: [7, 14, 21, 28],
  itinerary: [
    {
      dayNumber: 1,
      title: "УБ → Замын-Үүд → Эрээн",
      description:
        "Улаанбаатараас Замын-Үүд чиглэлд хөдөлж, хил нэвтрэн Эрээн хотод хүрнэ. Аяллын багтайгаа уулзаж, дараагийн өдрүүдийн хөтөлбөрөө бэлтгэнэ.",
      location: "Эрээн",
      meals: ["Оройн хоол"],
      accommodation: "Эрээн хотын зочид буудал",
      image: IMAGE_SET.itinerary[0],
    },
    {
      dayNumber: 2,
      title: "Эрээн → И Сань По",
      description:
        "Байгалийн үзэсгэлэнт И Сань По бүс рүү аялж, шилэн гүүр, хавцал, усан маршрутын үзэмжтэй хэсгүүдээр зочилно.",
      location: "И Сань По",
      meals: ["Өглөөний цай", "Өдрийн хоол", "Оройн хоол"],
      accommodation: "И Сань По зочид буудал",
      image: IMAGE_SET.itinerary[1],
    },
    {
      dayNumber: 3,
      title: "И Сань По → Жанчхүү",
      description:
        "Өглөөний цайны дараа Жанчхүү хотын чиглэлд аяллаа үргэлжлүүлнэ. Хотын төв, халуун рашаан болон амралтын хөтөлбөрт оролцоно.",
      location: "Жанчхүү",
      meals: ["Өглөөний цай", "Өдрийн хоол", "Оройн хоол"],
      accommodation: "Жанчхүү зочид буудал",
      image: IMAGE_SET.itinerary[2],
    },
    {
      dayNumber: 4,
      title: "Жанчхүү → Эрээн → Замын-Үүд → УБ",
      description:
        "Жанчхүүгээс буцах аяллаа эхлүүлж, Эрээн болон Замын-Үүдээр дамжин Улаанбаатарын чиглэлд хөдөлнө. УБ-т ирж аялал өндөрлөнө.",
      location: "Жанчхүү",
      meals: ["Өглөөний цай", "Өдрийн хоол"],
      accommodation: null,
      image: IMAGE_SET.itinerary[3],
    },
  ],
};

function compact(value) {
  return typeof value === "string" ? value.trim() : "";
}

function uniq(values) {
  return [...new Set(values.map(compact).filter(Boolean))];
}

function ensureLocalAssetsExist() {
  for (const image of [IMAGE_SET.cover, ...IMAGE_SET.itinerary, ...IMAGE_SET.gallery]) {
    if (!image.startsWith("/")) continue;
    const assetPath = path.resolve("public", image.slice(1));
    if (!fs.existsSync(assetPath)) {
      throw new Error(`Missing local image asset: ${assetPath}`);
    }
  }
}

async function assertRemoteImagesUniqueAndReachable() {
  const remoteImages = [...IMAGE_SET.itinerary, ...IMAGE_SET.gallery].filter((image) => image.startsWith("http"));
  const currentTrips = await prisma.trip.findMany({
    where: { isPublished: true, NOT: { sourceTripId: SOURCE_TRIP_ID } },
    select: { image: true, extraImages: true, itinerary: { select: { image: true } } },
  });

  const used = new Set();
  for (const trip of currentTrips) {
    [trip.image, ...trip.extraImages, ...trip.itinerary.map((day) => day.image)]
      .filter(Boolean)
      .forEach((image) => used.add(image));
  }

  for (const image of remoteImages) {
    if (used.has(image)) throw new Error(`Remote image already used by another published trip: ${image}`);
    const response = await fetch(image, { method: "HEAD" });
    if (!response.ok) throw new Error(`Remote image is not reachable: ${image}`);
  }
}

async function ensureTag(name) {
  const existing = await prisma.tag.findFirst({
    where: { name },
    select: { id: true, name: true, slug: true },
  });
  if (existing) return existing;

  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zа-яёөүңқһ0-9-]/gi, "")
    .replace(/-+/g, "-");
  return prisma.tag.upsert({
    where: { slug },
    update: { name },
    create: { name, slug },
  });
}

function departureStart(day) {
  return new Date(Date.UTC(2026, 7, day, 3, 0, 0));
}

function departureEnd(day) {
  return new Date(Date.UTC(2026, 7, day + 3, 3, 0, 0));
}

async function main() {
  ensureLocalAssetsExist();
  await assertRemoteImagesUniqueAndReachable();

  const category = await prisma.category.findUnique({
    where: { slug: TRIP_DATA.categorySlug },
    select: { id: true },
  });
  if (!category) throw new Error(`Category not found: ${TRIP_DATA.categorySlug}`);

  const tags = await Promise.all(TRIP_DATA.tagNames.map(ensureTag));

  const existing = await prisma.trip.findUnique({
    where: { sourceTripId: SOURCE_TRIP_ID },
    select: { id: true },
  });

  const baseData = {
    slug: TRIP_SLUG,
    title: TRIP_DATA.title,
    summary: TRIP_DATA.summary,
    description: TRIP_DATA.description,
    country: TRIP_DATA.country,
    city: TRIP_DATA.city,
    region: TRIP_DATA.region,
    destinations: TRIP_DATA.destinations,
    meetingPoint: "Улаанбаатар → Замын-Үүд чиглэлийн хөдөлгөөн",
    durationDays: TRIP_DATA.durationDays,
    durationNights: TRIP_DATA.durationNights,
    minTravelers: TRIP_DATA.minTravelers,
    maxTravelers: null,
    difficulty: TRIP_DATA.difficulty,
    transport: TRIP_DATA.transport,
    languages: TRIP_DATA.languages,
    season: TRIP_DATA.season,
    highlights: TRIP_DATA.highlights,
    included: TRIP_DATA.included,
    excluded: TRIP_DATA.excluded,
    requirements: "Иргэний үнэмлэх, хил нэвтрэх бичиг баримтаа бүрэн авч явна.",
    cancellationPolicy: null,
    importantNotes: TRIP_DATA.importantNotes,
    image: IMAGE_SET.cover,
    extraImages: uniq(IMAGE_SET.gallery),
    video: null,
    videos: [],
    price: TRIP_DATA.price,
    oldPrice: null,
    discount: 0,
    childPrice: TRIP_DATA.childPrice,
    infantPrice: null,
    singleSupplement: null,
    currency: TRIP_DATA.currency,
    sourceTripId: SOURCE_TRIP_ID,
    sourceMetadata: {
      importedAt: new Date().toISOString(),
      sourceType: "pdf-brochure",
      brochurePath: BROCHURE_PATH,
      route: "УБ → Замын-Үүд → Эрээн → И Сань По → Жанчхүү → Эрээн → Замын-Үүд → УБ",
      departureDates: TRIP_DATA.departureDays.map((day) => `2026-08-${String(day).padStart(2, "0")}`),
      phone: "86185769",
    },
    hotel: TRIP_DATA.hotel,
    foodIncluded: null,
    departureRule: "8 сарын 7, 14, 21, 28-нд гаралттай.",
    extraFees: [],
    roomPrices: [],
    childPriceNotes: [],
    brochurePdfUrl: TRIP_DATA.brochurePdfUrl,
    categoryId: category.id,
    isFeatured: true,
    isPublished: true,
    itinerary: {
      create: TRIP_DATA.itinerary.map((day) => ({
        dayNumber: day.dayNumber,
        title: day.title,
        description: day.description,
        location: day.location,
        meals: day.meals,
        accommodation: day.accommodation,
        image: day.image,
      })),
    },
    departures: {
      create: TRIP_DATA.departureDays.map((day) => ({
        startDate: departureStart(day),
        endDate: departureEnd(day),
        seatsTotal: null,
        seatsLeft: null,
        price: TRIP_DATA.price,
        childPrice: null,
        infantPrice: null,
        status: "OPEN",
      })),
    },
  };

  const saved = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.itineraryDay.deleteMany({ where: { tripId: existing.id } });
      await tx.departure.deleteMany({ where: { tripId: existing.id } });
      return tx.trip.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          tags: { set: tags.map((tag) => ({ id: tag.id })) },
        },
        select: { id: true, slug: true, title: true, image: true, extraImages: true },
      });
    }

    return tx.trip.create({
      data: {
        ...baseData,
        tags: { connect: tags.map((tag) => ({ id: tag.id })) },
      },
      select: { id: true, slug: true, title: true, image: true, extraImages: true },
    });
  });

  console.log(JSON.stringify({
    sourceTripId: SOURCE_TRIP_ID,
    saved,
    photoCount: 1 + saved.extraImages.length + TRIP_DATA.itinerary.length,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
