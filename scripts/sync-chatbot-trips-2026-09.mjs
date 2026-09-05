/**
 * One-time replace of booking-web's trip catalogue with the 22 live trips
 * from the chatbot project's database.
 *
 * What this does, in order:
 *   1. Reads all 22 rows from the chatbot DB's travel_trip_entries, joined
 *      to poster_trips (by extra.poster_trip_id) for real per-day photos —
 *      there is no separately-rendered "poster PNG" anywhere in either
 *      database; the actual asset is the per-day photo extracted from the
 *      client's uploaded trip document.
 *   2. Deletes every existing Trip in booking-web (cascades ItineraryDay/
 *      Departure/Testimonial, detaches Enquiry/TripView via SetNull —
 *      verified beforehand: 0 real bookings/enquiries/testimonials
 *      currently reference any trip, so nothing real is lost).
 *   3. Re-creates all 22 as new trips, sorted into the 5 existing categories
 *      by a hand-built lookup (the chatbot's own `category` column is
 *      generic "Аялал" on every row — it carries no signal), uploads each
 *      day's real photo to Cloudinary, and builds itinerary/departures/
 *      included/excluded from the chatbot's already-clean extracted data.
 *
 * Usage: node scripts/sync-chatbot-trips-2026-09.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const DRY_RUN = process.argv.includes("--dry-run");

const CHATBOT_DIR =
  "c:/Dev/Nexon-nova-company/clients-chatbot/Uudam-travel-brand/uudam-travel-chatbot";

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

// ---------------------------------------------------------------------------
// Shared helpers (copied from scripts/import-chatbot-trips.mjs rather than
// imported, so this stays a standalone, readable one-time script).
// ---------------------------------------------------------------------------

function compact(value) {
  return typeof value === "string" ? value.trim() : "";
}

function array(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim())
    : [];
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

async function uniqueSlug(prisma, base) {
  let candidate = base;
  let counter = 2;
  for (;;) {
    const existing = await prisma.trip.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

// ---------------------------------------------------------------------------
// Category assignment. The chatbot's own `category` column is "Аялал" on
// every one of the 22 rows — no usable signal — so this maps each trip by
// its actual route, matching the 5 categories already live on the site.
// Several trip titles literally contain the category name; the rest follow
// the agency's two standing patterns: Inner-Mongolia-border routes (Hailar,
// Hohhot, Datong, Ordos, Jining — reached overland via Erenhot) go to
// "газрын аялал", coastal/island flight destinations (Shanghai, Hainan,
// Jeju) go to "шууд нислэгтэй".
// ---------------------------------------------------------------------------
const CATEGORY_SLUG_BY_ROUTE_KEYWORD = [
  // Explicit in the title — no judgment call needed.
  { match: /газар\s*нислэг\s*хосолсон/i, slug: "gazar-nisleg-hosolson" },
  { match: /шууд\s*нислэгтэй/i, slug: "shuud-nislegtei-ayalal" },
  { match: /газрын\s*аялал/i, slug: "gazryn-ayalal" },
  { match: /усан\s*онгоц/i, slug: "kruz-ayalal" },
  // Inner Mongolia / overland border-crossing pattern.
  { match: /хайлаар|манжуур|чичихар|хөх\s*хот|датон|ордос|жинин|жанжакоу|эрээн/i, slug: "gazryn-ayalal" },
  // Flight-only coastal / island / major-city destinations.
  { match: /шанхай|хайнан|жэжү|чежү|бээжин|юниверсал|тэнгэрийн\s*хаалга|хүжөү|ханжоу|пүюань/i, slug: "shuud-nislegtei-ayalal" },
];

function guessCategorySlug(routeName) {
  for (const rule of CATEGORY_SLUG_BY_ROUTE_KEYWORD) {
    if (rule.match.test(routeName)) return rule.slug;
  }
  return null; // caller decides the fallback
}

// ---------------------------------------------------------------------------
// Chatbot DB read
// ---------------------------------------------------------------------------

async function loadChatbotTrips() {
  loadEnvFile(path.join(CHATBOT_DIR, ".env"));
  loadEnvFile(path.join(CHATBOT_DIR, ".env.local"));
  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  const chatbotRequire = createRequire(path.join(CHATBOT_DIR, "package.json"));
  const { Client } = chatbotRequire("pg");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const entries = await client.query(`
    SELECT id, route_name, duration_text, adult_price, child_price, currency,
           seats_total, seats_left, has_food, hotel, notes, extra
    FROM travel_trip_entries
    WHERE status = 'active'
    ORDER BY updated_at DESC
  `);

  const posterIds = entries.rows
    .map((r) => r.extra?.poster_trip_id)
    .filter((id) => typeof id === "string" && id.length > 0);

  const posters = posterIds.length
    ? await client.query(`SELECT id, data FROM poster_trips WHERE id = ANY($1::text[])`, [posterIds])
    : { rows: [] };
  const posterById = new Map(posters.rows.map((p) => [p.id, p.data]));

  await client.end();

  return entries.rows.map((row) => ({
    ...row,
    posterData: posterById.get(row.extra?.poster_trip_id) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Cloudinary upload — base64 JPEGs already carry a data: prefix from the
// source DB, which Cloudinary's upload endpoint accepts directly as `file`.
// ---------------------------------------------------------------------------

async function uploadToCloudinary(dataUri) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "uudam-booking-trips";
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;

  const crypto = await import("node:crypto");
  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + apiSecret)
    .digest("hex");

  const form = new FormData();
  form.append("file", dataUri);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Cloudinary upload failed: ${res.status} ${await res.text()}`);
  }

  const body = await res.json();
  return body.secure_url;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN — no writes ===" : "=== LIVE RUN ===");

  const chatbotTrips = await loadChatbotTrips();
  console.log(`Loaded ${chatbotTrips.length} active trips from the chatbot database.`);

  const prisma = new PrismaClient();

  const categories = await prisma.category.findMany({ select: { id: true, slug: true, categoryName: true } });
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const fallbackCategory = categoryBySlug.get("eronhii-ayalal") ?? categories[0];

  if (!fallbackCategory) {
    throw new Error("No categories exist in booking-web — run the app's seed first.");
  }

  const now = new Date();
  const report = { imported: [], drafts: [], categoryCounts: {}, uncategorized: [] };

  if (!DRY_RUN) {
    const existingCount = await prisma.trip.count();
    console.log(`Deleting ${existingCount} existing trips (categories are kept)...`);
    await prisma.trip.deleteMany({});
  }

  for (const source of chatbotTrips) {
    const extra = source.extra ?? {};
    const title = compact(source.route_name) || "Untitled trip";
    const { days: durationDays, nights: durationNights } = parseDuration(source.duration_text);

    const categorySlug = guessCategorySlug(title) ?? fallbackCategory.slug;
    const category = categoryBySlug.get(categorySlug) ?? fallbackCategory;
    report.categoryCounts[category.categoryName] = (report.categoryCounts[category.categoryName] ?? 0) + 1;
    if (!guessCategorySlug(title)) report.uncategorized.push(title);

    const hasPrice = typeof source.adult_price === "number";
    if (!hasPrice) report.drafts.push(title);

    // Itinerary days, zipped 1:1 with the poster's per-day photos — verified
    // on a sample trip that both arrays are the same length and order.
    const itineraryDaysSource = Array.isArray(extra.itinerary_days) ? extra.itinerary_days : [];
    const posterDays = Array.isArray(source.posterData?.days) ? source.posterData.days : [];

    const uploadedPhotos = [];
    if (!DRY_RUN) {
      for (const day of posterDays) {
        if (typeof day.photo !== "string" || !day.photo.startsWith("data:image")) {
          uploadedPhotos.push(null);
          continue;
        }
        try {
          uploadedPhotos.push(await uploadToCloudinary(day.photo));
        } catch (err) {
          console.error(`  ! photo upload failed for "${title}" day ${day.day}:`, err.message);
          uploadedPhotos.push(null);
        }
      }
    }

    const heroImage = uploadedPhotos.find(Boolean) ?? null;
    const extraImages = uploadedPhotos.filter((url) => url && url !== heroImage);

    const itinerary = itineraryDaysSource.map((day, index) => {
      const meals = [];
      if (day.meals?.breakfast) meals.push("Өглөө");
      if (day.meals?.lunch) meals.push("Өдөр");
      if (day.meals?.dinner) meals.push("Орой");

      return {
        dayNumber: day.day ?? index + 1,
        title: compact(day.title) || `${index + 1}-р өдөр`,
        description: compact(day.description) || null,
        accommodation: compact(day.hotel) || null,
        meals,
        image: uploadedPhotos[index] ?? null,
      };
    });

    const departureDatesResolved = Array.isArray(extra.departure_dates_resolved)
      ? extra.departure_dates_resolved
      : [];

    const departures = departureDatesResolved
      .map((d) => new Date(d.ymd))
      .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() >= now.getTime())
      .map((startDate) => ({
        startDate,
        seatsTotal: typeof source.seats_total === "number" ? source.seats_total : null,
        seatsLeft: typeof source.seats_left === "number" ? source.seats_left : null,
        status: "OPEN",
      }));

    const description =
      compact(source.notes) ||
      compact(extra.original_title_text) ||
      `${title} — дэлгэрэнгүй мэдээллийг хөтөлбөрөөс үзнэ үү.`;

    const baseSlug = slugify(title, "trip");
    const slug = DRY_RUN ? baseSlug : await uniqueSlug(prisma, baseSlug);

    const tripData = {
      slug,
      title,
      description,
      durationDays: durationDays || 1,
      durationNights,
      price: hasPrice ? source.adult_price : 0,
      childPrice: typeof source.child_price === "number" ? source.child_price : null,
      currency: source.currency || "MNT",
      hotel: compact(source.hotel) || null,
      foodIncluded: typeof source.has_food === "boolean" ? source.has_food : null,
      image: heroImage || "",
      extraImages,
      included: array(extra.included_items),
      excluded: array(extra.excluded_items),
      importantNotes: array(extra.important_notes),
      brochurePdfUrl: compact(extra.brochure_pdf_url) || null,
      sourceTripId: source.id,
      sourceMetadata: extra,
      categoryId: category.id,
      isPublished: hasPrice,
      isFeatured: false,
      itinerary: { create: itinerary },
      departures: { create: departures },
    };

    if (DRY_RUN) {
      console.log(
        `[dry-run] ${title} -> category="${category.categoryName}" price=${tripData.price}${hasPrice ? "" : " (DRAFT — no price)"} days=${itinerary.length} departures=${departures.length}`,
      );
    } else {
      await prisma.trip.create({ data: tripData });
      console.log(
        `✓ ${title} -> ${category.categoryName} | ${itinerary.length} days | ${departures.length} departures | ${extraImages.length + (heroImage ? 1 : 0)} photos${hasPrice ? "" : " [DRAFT]"}`,
      );
    }

    report.imported.push(title);
  }

  console.log("\n=== Summary ===");
  console.log(`Imported: ${report.imported.length} / ${chatbotTrips.length}`);
  console.log("By category:", JSON.stringify(report.categoryCounts, null, 2));
  if (report.drafts.length) {
    console.log(`\nDRAFT (no price set — needs staff to fill in before publishing):`);
    for (const t of report.drafts) console.log("  -", t);
  }
  if (report.uncategorized.length) {
    console.log(`\nFell back to default category (no keyword match):`);
    for (const t of report.uncategorized) console.log("  -", t);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
