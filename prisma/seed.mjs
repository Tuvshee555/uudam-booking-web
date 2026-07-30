/**
 * Demo seed — sample categories and trips so a fresh database renders
 * something. This is sample DATA only; no code anywhere reads these names,
 * prices or dates, so the agency can delete every row here without breaking
 * anything.
 *
 * Run with:  node prisma/seed.mjs
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@uudam.mn";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "uudam-admin-2026";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      email: adminEmail,
      password: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
      isVerified: true,
      firstName: "Uudam",
      lastName: "Admin",
    },
  });

  console.log(`Admin ready: ${admin.email}`);

  const asia = await prisma.category.upsert({
    where: { slug: "azi" },
    update: {},
    create: { categoryName: "Ази", slug: "azi" },
  });

  const europe = await prisma.category.upsert({
    where: { slug: "evrop" },
    update: {},
    create: { categoryName: "Европ", slug: "evrop" },
  });

  const domestic = await prisma.category.upsert({
    where: { slug: "dotood" },
    update: {},
    create: { categoryName: "Дотоод аялал", slug: "dotood" },
  });

  const japan = await prisma.category.upsert({
    where: { slug: "yapon" },
    update: {},
    create: { categoryName: "Япон", slug: "yapon", parentId: asia.id },
  });

  const trips = [
    {
      slug: "yapon-sakura-7-honog",
      title: "Япон — Сакурагийн улирал 7 хоног",
      summary: "Токио, Киото, Осака — сакура цэцэглэх хамгийн сайхан улиралд",
      description:
        "Японы хамгийн үзэсгэлэнтэй улирал болох сакура цэцэглэх үед Токио, Киото, Осака гурван хотоор аялна. Эртний сүм хийд, орчин үеийн технологи, дэлхийд алдартай хоолны соёлыг нэг аялалд багтаалаа.",
      country: "Япон",
      city: "Токио",
      destinations: ["Токио", "Киото", "Осака"],
      durationDays: 7,
      durationNights: 6,
      difficulty: "EASY",
      transport: ["Онгоц", "Хурдны галт тэрэг", "Автобус"],
      languages: ["Монгол", "Англи"],
      season: "Хавар",
      highlights: [
        "Сакура цэцэглэх Уэно цэцэрлэгт хүрээлэн",
        "Киотогийн Фушими Инари сүм",
        "Осакагийн шөнийн хоолны гудамж",
        "Шинкансэн хурдны галт тэрэгний аялал",
      ],
      included: ["Онгоцны тийз", "Зочид буудал", "Өглөөний хоол", "Хөтөч", "Даатгал"],
      excluded: ["Виз", "Өдрийн болон оройн хоол", "Хувийн зардал"],
      image:
        "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=80",
      extraImages: [
        "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1600&q=80",
      ],
      price: 4_900_000,
      childPrice: 4_200_000,
      categoryId: japan.id,
      isFeatured: true,
      minTravelers: 2,
      maxTravelers: 20,
      itinerary: [
        { title: "Улаанбаатар → Токио", description: "Онгоцны буудлаас угтаж, зочид буудалд байрлана.", location: "Токио" },
        { title: "Токио хотын аялал", description: "Асакуса, Шибуяа, Скайтри цамхаг.", location: "Токио", meals: ["Өглөө"] },
        { title: "Уэно цэцэрлэг — сакура", description: "Сакура цэцэглэх улиралд ханами ёслол.", location: "Токио", meals: ["Өглөө"] },
        { title: "Токио → Киото", description: "Шинкансэн галт тэргээр Киото руу.", location: "Киото", meals: ["Өглөө"] },
        { title: "Киотогийн сүм хийд", description: "Фушими Инари, Киёмизү-дэра.", location: "Киото", meals: ["Өглөө"] },
        { title: "Осака", description: "Осака цайз, Дотонбори гудамж.", location: "Осака", meals: ["Өглөө"] },
        { title: "Осака → Улаанбаатар", description: "Буцах нислэг.", location: "Осака", meals: ["Өглөө"] },
      ],
      departures: [
        { startDate: daysFromNow(45), endDate: daysFromNow(52), seatsTotal: 20, seatsLeft: 14 },
        { startDate: daysFromNow(75), endDate: daysFromNow(82), seatsTotal: 20, seatsLeft: 20 },
      ],
    },
    {
      slug: "solongos-seoul-jeju-5-honog",
      title: "Солонгос — Сөүл ба Жэжү 5 хоног",
      summary: "Сөүлийн дэлгүүр хэсэлт, Жэжү арлын байгаль",
      description:
        "Сөүл хотын амьд соёл, дэлгүүр хэсэлт, дараа нь Жэжү арлын галт уулын байгаль, далайн эрэг. Гэр бүлээрээ явахад тохиромжтой аялал.",
      country: "Солонгос",
      city: "Сөүл",
      destinations: ["Сөүл", "Жэжү"],
      durationDays: 5,
      durationNights: 4,
      difficulty: "EASY",
      transport: ["Онгоц", "Автобус"],
      languages: ["Монгол"],
      season: "Зун",
      highlights: ["Гёнбоккун ордон", "Мёндон гудамж", "Жэжү арлын Сонсан оргил"],
      included: ["Онгоцны тийз", "Зочид буудал", "Өглөөний хоол", "Хөтөч"],
      excluded: ["Виз", "Хувийн зардал"],
      image:
        "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1600&q=80",
      price: 2_850_000,
      childPrice: 2_400_000,
      categoryId: asia.id,
      isFeatured: true,
      minTravelers: 1,
      maxTravelers: 25,
      itinerary: [
        { title: "Улаанбаатар → Сөүл", description: "Ирээд хотын аялал.", location: "Сөүл" },
        { title: "Сөүл хот", description: "Ордон, зах, дэлгүүр хэсэлт.", location: "Сөүл", meals: ["Өглөө"] },
        { title: "Сөүл → Жэжү", description: "Дотоодын нислэгээр Жэжү арал руу.", location: "Жэжү", meals: ["Өглөө"] },
        { title: "Жэжү арал", description: "Сонсан оргил, далайн эрэг.", location: "Жэжү", meals: ["Өглөө"] },
        { title: "Буцах нислэг", description: "Жэжү → Улаанбаатар.", location: "Жэжү", meals: ["Өглөө"] },
      ],
      departures: [
        { startDate: daysFromNow(21), endDate: daysFromNow(26), seatsTotal: 25, seatsLeft: 6 },
        { startDate: daysFromNow(60), endDate: daysFromNow(65), seatsTotal: 25, seatsLeft: 25 },
      ],
    },
    {
      slug: "govi-gurvan-saihan-4-honog",
      title: "Говь гурван сайхан 4 хоног",
      summary: "Хонгорын элс, Ёлын ам, Баянзаг",
      description:
        "Монголын өмнөд говийн хамгийн алдартай гурван цэгээр аялна. Тэмээн жин, элсэн манхан, үлэг гүрвэлийн олдворын газар.",
      country: "Монгол",
      city: "Даланзадгад",
      destinations: ["Ёлын ам", "Хонгорын элс", "Баянзаг"],
      durationDays: 4,
      durationNights: 3,
      difficulty: "MODERATE",
      transport: ["Джип", "Дотоодын нислэг"],
      languages: ["Монгол", "Англи"],
      season: "Зун",
      highlights: ["Хонгорын элсэн манхан", "Ёлын амны мөсөн хавцал", "Баянзагийн улаан хад"],
      included: ["Тээвэр", "Гэр буудал", "Гурван цагийн хоол", "Хөтөч"],
      excluded: ["Дотоодын нислэг", "Хувийн зардал"],
      image:
        "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=1600&q=80",
      price: 890_000,
      childPrice: 650_000,
      categoryId: domestic.id,
      minTravelers: 2,
      maxTravelers: 12,
      itinerary: [
        { title: "Улаанбаатар → Ёлын ам", description: "Замын аялал, гэр буудалд байрлана.", location: "Ёлын ам" },
        { title: "Хонгорын элс", description: "Тэмээн жин, элсэн манхан.", location: "Хонгорын элс", meals: ["Өглөө", "Өдөр", "Орой"] },
        { title: "Баянзаг", description: "Улаан хад, үлэг гүрвэлийн олдвор.", location: "Баянзаг", meals: ["Өглөө", "Өдөр", "Орой"] },
        { title: "Буцах зам", description: "Улаанбаатар руу.", location: "Улаанбаатар", meals: ["Өглөө"] },
      ],
      departures: [
        { startDate: daysFromNow(14), endDate: daysFromNow(18), seatsTotal: 12, seatsLeft: 3 },
        { startDate: daysFromNow(35), endDate: daysFromNow(39), seatsTotal: 12, seatsLeft: 12 },
      ],
    },
    {
      slug: "turk-istanbul-kapadok-8-honog",
      title: "Турк — Истанбул ба Каппадокия 8 хоног",
      summary: "Хоёр тивийг холбосон хот ба агаарын бөмбөлөг",
      description:
        "Истанбулын түүхэн сүм, зах, Босфорын хоолой. Каппадокияд агаарын бөмбөлгөөр нисэж, чулуун хотуудыг үзнэ.",
      country: "Турк",
      city: "Истанбул",
      destinations: ["Истанбул", "Каппадокия"],
      durationDays: 8,
      durationNights: 7,
      difficulty: "EASY",
      transport: ["Онгоц", "Автобус"],
      languages: ["Монгол", "Англи"],
      season: "Намар",
      highlights: ["Айя София", "Босфорын хоолойн аялал", "Агаарын бөмбөлгийн нислэг"],
      included: ["Онгоцны тийз", "Зочид буудал", "Өглөөний хоол", "Хөтөч", "Даатгал"],
      excluded: ["Виз", "Агаарын бөмбөлгийн нислэг", "Хувийн зардал"],
      image:
        "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?auto=format&fit=crop&w=1600&q=80",
      price: 5_600_000,
      childPrice: 4_900_000,
      categoryId: europe.id,
      minTravelers: 2,
      maxTravelers: 18,
      itinerary: [
        { title: "Улаанбаатар → Истанбул", description: "Ирээд амарна.", location: "Истанбул" },
        { title: "Истанбулын түүхэн хэсэг", description: "Айя София, Цэнхэр сүм.", location: "Истанбул", meals: ["Өглөө"] },
        { title: "Босфорын хоолой", description: "Усан онгоцны аялал.", location: "Истанбул", meals: ["Өглөө"] },
        { title: "Истанбул → Каппадокия", description: "Дотоодын нислэг.", location: "Каппадокия", meals: ["Өглөө"] },
        { title: "Агаарын бөмбөлөг", description: "Үүрээр нислэг (нэмэлт).", location: "Каппадокия", meals: ["Өглөө"] },
        { title: "Чулуун хотууд", description: "Гөрөмэ, газар доорх хот.", location: "Каппадокия", meals: ["Өглөө"] },
        { title: "Каппадокия → Истанбул", description: "Чөлөөт цаг, дэлгүүр хэсэлт.", location: "Истанбул", meals: ["Өглөө"] },
        { title: "Буцах нислэг", description: "Истанбул → Улаанбаатар.", location: "Истанбул", meals: ["Өглөө"] },
      ],
      departures: [
        { startDate: daysFromNow(90), endDate: daysFromNow(98), seatsTotal: 18, seatsLeft: 18 },
      ],
    },
  ];

  for (const { itinerary, departures, ...trip } of trips) {
    await prisma.trip.upsert({
      where: { slug: trip.slug },
      update: {},
      create: {
        ...trip,
        itinerary: {
          create: itinerary.map((day, index) => ({
            dayNumber: index + 1,
            title: day.title,
            description: day.description ?? null,
            location: day.location ?? null,
            meals: day.meals ?? [],
          })),
        },
        departures: { create: departures },
      },
    });

    console.log(`Seeded trip: ${trip.title}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
