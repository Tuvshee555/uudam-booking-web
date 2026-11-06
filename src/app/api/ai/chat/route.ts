import { clientIp, handler, httpError, json, rateLimit, readJson } from "@/server/http";
import { loadSearchableTrips, searchTrips, type SearchableTrip } from "@/server/tripSearch";
import { asksToBook, describeOffer, questionMonth, STAFF_CONFIRM_LINE, tripOffer, type NextDeparture } from "@/lib/tripAdvisor";
import { openaiJson } from "@/server/openai";
import { formatMnt } from "@/lib/pricing";
import { formatTripDuration } from "@/lib/tripDisplay";

type ChatItem = {
  id: string;
  slug: string;
  name: string;
  /** The "-с эхлэн" price the trip card shows: the cheapest date still open. */
  price: number | null;
  image: string | null;
  durationDays: number;
  durationNights: number;
  country: string | null;
  nextDepartures: NextDeparture[];
  openCount: number;
};

function toItem(trip: SearchableTrip, now: number, month: number | null): ChatItem {
  const offer = tripOffer(trip, now, 3, month);
  return {
    id: trip.id,
    slug: trip.slug,
    name: trip.title,
    price: offer.fromPrice,
    image: trip.image || null,
    durationDays: trip.durationDays,
    durationNights: trip.durationNights ?? 0,
    country: trip.country,
    nextDepartures: offer.nextDepartures,
    openCount: offer.openCount,
  };
}

/** Reply written from the catalog alone — no model involved. */
function localReply(trips: SearchableTrip[], question: string, now: number, month: number | null) {
  if (!trips.length) {
    return `"${question}" гэсэн хайлтад тохирох аялал олдсонгүй. Өөр газар эсвэл огноо хэлж өгвөл хайж өгье.`;
  }
  const lines = trips.map((trip) => `• ${describeOffer(trip, tripOffer(trip, now, 3, month))}`).join("\n");
  const handoff = asksToBook(question) ? `\n${STAFF_CONFIRM_LINE}` : "";
  return `Танд эдгээр аялал тохирч магадгүй:\n${lines}${handoff}`;
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
 * The catalog search runs first and always produces an answer, from the same
 * trip and departure rows the website pages render. The model is only used to
 * phrase that answer more naturally and may quote nothing beyond the facts it
 * is given, so an expired or rate-limited API key degrades the wording rather
 * than the facts. Booking and payment are never confirmed here: staff do that.
 */
export const POST = handler(async (req: Request) => {
  rateLimit(`ai:${clientIp(req)}`, { windowMs: 15 * 60 * 1000, max: 30 });

  const body = await readJson(req);
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) throw httpError(400, "Асуултаа бичнэ үү");

  const now = Date.now();
  const trips = await loadSearchableTrips();
  const matches = searchTrips(message, trips, now);
  const shortlist = matches.map((match) => match.trip);
  const month = questionMonth(message);
  const items = shortlist.map((trip) => toItem(trip, now, month));

  if (!process.env.OPENAI_API_KEY) {
    return json({ reply: localReply(shortlist, message, now, month), items, source: "catalog" });
  }

  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-6)
    .map((entry: { role?: string; text?: string }) =>
      `${(entry.role ?? "user").toUpperCase()}: ${entry.text ?? ""}`,
    )
    .join("\n");

  // Only the shortlist is sent to the model, with the same facts the pages
  // show, so it can't invent a trip, a price or a date that isn't for sale.
  const context = shortlist
    .map((trip) => {
      const offer = tripOffer(trip, now, 3, month);
      // Dates and amounts already written the way the site writes them, so the
      // model copies "12-р сарын 1 (2,890,000₮)" instead of restyling it.
      const dates = offer.nextDepartures.length
        ? offer.nextDepartures.map((entry) => `${entry.label}${entry.price !== null ? ` (${formatMnt(entry.price)})` : ""}`).join(", ") + (offer.openCount > offer.nextDepartures.length ? ` ба өөр ${offer.openCount - offer.nextDepartures.length} огноо` : "")
        : "нээлттэй огноо алга";
      return `ID:${trip.id} | НЭР:${trip.title.replace(/[\n\r]/g, " ")} | ҮНЭ:${offer.fromPrice !== null ? `${formatMnt(offer.fromPrice)}-с эхэлнэ` : "ажилтнаас лавлана"} | ХУГАЦАА:${formatTripDuration(trip.durationDays, trip.durationNights) || "ажилтнаас лавлана"} | ОЙРЫН ОГНОО:${dates} | ГАЗАР:${[trip.country, trip.city].filter(Boolean).join(", ")}`;
    })
    .join("\n");

  const prompt = `Чи бол Uudam Travel аялалын агентлагийн вэбсайтын туслах. Зөвхөн доорх жагсаалтаас санал болго.

Ярианы түүх:
${history}

Боломжит аялалууд (өнөөдрийн бодит мэдээлэл):
${context || "(тохирох аялал олдсонгүй)"}

Хэрэглэгч: ${message}

Дүрэм:
- Зөвхөн монголоор, найрсаг, 2-4 өгүүлбэрээр хариул.
- Дээрх жагсаалтад байхгүй аялал, үнэ, огноо ЗОХИОЖ БОЛОХГҮЙ. Үнэ, огноог жагсаалтад бичигдсэн хэлбэрээр нь яг хуул (жишээ: "12-р сарын 1 (2,890,000₮)").
- Аялал бүрийн үнэ, огноог тухайн аяллын нэрийн хамт хэл; өөр өөр аяллын үнийг нэг өгүүлбэрт холихгүй.
- Огноо, гаралт асуувал ОЙРЫН ОГНОО талбарын огноонуудыг үнэтэй нь хэл. "Нээлттэй огноо алга" бол огноог ажилтнаас лавлахыг зөвлө.
- Хамгийн ихдээ 3 аялал санал болго.
- Жагсаалт хоосон бол өөр газар/огноо тодруулж асуу.
- Чи захиалга авдаггүй, суудал хадгалдаггүй, төлбөр авдаггүй. "Төлбөр төлөх боломжтой", "захиалга баталгаажлаа" гэх мэт үг ХЭЗЭЭ Ч бүү хэл: захиалга, суудал, төлбөрийг зөвхөн ажилтан утас эсвэл Messenger-ээр баталгаажуулна гэж хэл.

Яг нэг JSON объект буцаа, өөр юу ч бичихгүй:
{"reply":"хариу текст","ids":["tripId"]}`;

  try {
    const text = await openaiJson(prompt, { timeoutMs: 20000 });

    const parsed = extractFirstJson(text);
    if (!parsed?.reply) {
      return json({ reply: localReply(shortlist, message, now, month), items, source: "catalog" });
    }

    // Trust the wording, not the ids: anything the model returned that isn't
    // in our shortlist is dropped.
    const modelIds = Array.isArray(parsed.ids) ? parsed.ids.map(String) : [];
    const validItems = modelIds.length
      ? items.filter((item) => modelIds.includes(item.id))
      : items;

    // The handoff line is appended here, not left to the model: a booking or
    // payment question always ends with who actually confirms it.
    const reply = asksToBook(message) && !parsed.reply.includes("ажилтан") ? `${parsed.reply.trim()} ${STAFF_CONFIRM_LINE}` : parsed.reply;
    return json({
      reply,
      items: validItems.length ? validItems : items,
      source: "ai",
    });
  } catch (err) {
    console.error("AI chat degraded to catalog search:", err);
    return json({ reply: localReply(shortlist, message, now, month), items, source: "catalog" });
  }
});
