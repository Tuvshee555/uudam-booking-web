import { GoogleGenerativeAI } from "@google/generative-ai";
import { clientIp, handler, httpError, json, rateLimit, readJson } from "@/server/http";
import { loadSearchableTrips, searchTrips, type SearchableTrip } from "@/server/tripSearch";
import { formatMnt } from "@/lib/pricing";

const GEN_MODEL = process.env.GEN_MODEL || "gemini-2.5-flash";

type ChatItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  durationDays: number;
  country: string | null;
};

function toItem(trip: SearchableTrip): ChatItem {
  return {
    id: trip.id,
    slug: trip.slug,
    name: trip.title,
    price: trip.price,
    image: trip.image || null,
    durationDays: trip.durationDays,
    country: trip.country,
  };
}

/** Reply written from the catalog alone — no model involved. */
function localReply(items: ChatItem[], question: string) {
  if (!items.length) {
    return `"${question}" гэсэн хайлтад тохирох аялал олдсонгүй. Өөр газар эсвэл огноо хэлж өгвөл хайж өгье.`;
  }

  const lines = items
    .map(
      (item) =>
        `• ${item.name} — ${item.durationDays} хоног, ${formatMnt(item.price)}-с эхэлнэ`,
    )
    .join("\n");

  return `Танд эдгээр аялал тохирч магадгүй:\n${lines}`;
}

function extractFirstJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as { reply?: string; ids?: unknown };
  } catch {
    return null;
  }
}

/**
 * POST /api/ai/chat — trip advisor.
 *
 * The catalog search runs first and always produces an answer. The model is
 * only used to phrase that answer more naturally, so an expired or
 * rate-limited API key degrades the wording rather than breaking the feature.
 */
export const POST = handler(async (req: Request) => {
  rateLimit(`ai:${clientIp(req)}`, { windowMs: 15 * 60 * 1000, max: 30 });

  const body = await readJson(req);
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) throw httpError(400, "Асуултаа бичнэ үү");

  const trips = await loadSearchableTrips();
  const matches = searchTrips(message, trips);
  const items = matches.map((match) => toItem(match.trip));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ reply: localReply(items, message), items, source: "catalog" });
  }

  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-6)
    .map((entry: { role?: string; text?: string }) =>
      `${(entry.role ?? "user").toUpperCase()}: ${entry.text ?? ""}`,
    )
    .join("\n");

  // Only the shortlist is sent to the model, so it can't invent a trip that
  // isn't for sale.
  const context = matches
    .map(
      ({ trip }) =>
        `ID:${trip.id} | НЭР:${trip.title.replace(/[\n\r]/g, " ")} | ҮНЭ:${trip.price} | ХОНОГ:${trip.durationDays} | ГАЗАР:${[trip.country, trip.city].filter(Boolean).join(", ")}`,
    )
    .join("\n");

  const prompt = `Чи бол Uudam Travel аялалын агентлагийн туслах. Зөвхөн доорх жагсаалтаас санал болго.

Ярианы түүх:
${history}

Боломжит аялалууд:
${context || "(тохирох аялал олдсонгүй)"}

Хэрэглэгч: ${message}

Дүрэм:
- Зөвхөн монголоор, найрсаг, 2-3 өгүүлбэрээр хариул.
- Дээрх жагсаалтад байхгүй аялал, үнэ, огноо ЗОХИОЖ БОЛОХГҮЙ.
- Хамгийн ихдээ 3 аялал санал болго.
- Жагсаалт хоосон бол өөр газар/огноо тодруулж асуу.

Яг нэг JSON объект буцаа, өөр юу ч бичихгүй:
{"reply":"хариу текст","ids":["tripId"]}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEN_MODEL });
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() ?? "";

    const parsed = extractFirstJson(text);
    if (!parsed?.reply) {
      return json({ reply: localReply(items, message), items, source: "catalog" });
    }

    // Trust the wording, not the ids: anything the model returned that isn't
    // in our shortlist is dropped.
    const modelIds = Array.isArray(parsed.ids) ? parsed.ids.map(String) : [];
    const validItems = modelIds.length
      ? items.filter((item) => modelIds.includes(item.id))
      : items;

    return json({
      reply: parsed.reply,
      items: validItems.length ? validItems : items,
      source: "ai",
    });
  } catch (err) {
    console.error("AI chat degraded to catalog search:", err);
    return json({ reply: localReply(items, message), items, source: "catalog" });
  }
});
