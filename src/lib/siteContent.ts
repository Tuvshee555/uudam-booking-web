/**
 * Admin-editable static site copy, same pattern as aboutContent.ts:
 * defaults live here (the original hardcoded strings), a parse function
 * validates/clamps whatever comes back off the wire, and each page reads
 * from SiteSettings with these as the fallback so nothing goes blank
 * before the client has edited anything.
 *
 * getSiteSettings() (below) is the one place every page should read this
 * row from — six pages independently calling prisma.siteSettings.findUnique
 * during `next build`'s parallel static generation was enough extra
 * connection pressure on Neon's pooler to intermittently fail the build.
 */

export type FaqItem = { q: string; a: string; topic?: string };
export type TermsSection = { title: string; body: string };

export const DEFAULT_HOME_HERO_EYEBROW = "Uudam Travel Agency · Улаанбаатар";
export const DEFAULT_HOME_HERO_TITLE = "Дараагийн аялалаа";
export const DEFAULT_HOME_HERO_TITLE_ACCENT = "эндээс эхлүүл";
export const DEFAULT_HOME_HERO_SUBTITLE =
  "Өдөр тутмын хөтөлбөр, огноо бүрийн үнэ, багцад багтсан зүйлс — бүгд ил тод. Аяллаа сонгоод захиалгаа онлайнаар үлдээгээрэй.";
export const DEFAULT_HOME_HERO_PRIMARY_CTA = "Аялал үзэх";
export const DEFAULT_HOME_HERO_SECONDARY_CTA = "Зөвлөгөө авах";
/** No default: a line like "new trips every week" is a promise only staff can make. */
export const DEFAULT_HOME_HERO_BADGE = "";

/**
 * Empty on purpose. The hero used to fall back to stock photos of places the
 * agency does not sell; with no photos chosen here it now shows the covers of
 * real trips and links each to its trip (see lib/homeSections.ts).
 */
export const DEFAULT_HOME_HERO_IMAGES: string[] = [];

/** Validates and clamps admin-submitted hero photo URLs — never trust JSON off the wire. */
export function parseHeroImages(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 1000))
    .slice(0, 10);
}

/**
 * TrustBar's first 2 facts (icon, title, text) — free text, same {icon,
 * title, text} shape as the About page's value cards. The 3rd fact (phone)
 * keeps its dynamic CONTACT.phone interpolation and only exposes its text
 * as a template with a {{phone}} placeholder; the 4th (live trip count)
 * isn't exposed at all — faking that number would contradict the file's
 * own "real, verifiable facts only" design.
 */
export type TrustFact = { icon: string; title: string; text: string };

export const DEFAULT_TRUST_FACTS: TrustFact[] = [
  {
    icon: "shield",
    title: "Ил тод үнэ",
    text: "Багцад юу багтсан, юу ороогүйг аялал бүрт тусад нь бичсэн.",
  },
  { icon: "phone", title: "Шууд холбоо", text: "{{phone}}" },
];

export const DEFAULT_TRUST_PHONE_TEXT = "{{phone}} дугаараар, Messenger, WhatsApp-аар ажилтантай шууд ярина.";
export const DEFAULT_TRUST_PHONE_TEXT_NO_PHONE = "Ажилтантай Messenger-ээр шууд холбогдоно.";

/** Validates and clamps admin-submitted trust facts — never trust JSON off the wire. */
export function parseTrustFacts(value: unknown): TrustFact[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      icon: typeof item.icon === "string" ? item.icon : "sparkles",
      title: typeof item.title === "string" ? item.title.trim().slice(0, 120) : "",
      text: typeof item.text === "string" ? item.text.trim().slice(0, 300) : "",
    }))
    .filter((item) => item.title || item.text)
    .slice(0, 6);
}

export const DEFAULT_CUSTOM_TRIP_TITLE = "Огноо тохирохгүй байна уу?";
export const DEFAULT_CUSTOM_TRIP_BODY =
  "Гэр бүл, найз нөхөд, хамт олондоо зориулж өөрийн огноогоор аялал зохион байгуулж " +
  "өгнө. Хүссэн чиглэл, ойролцоо огноогоо үлдээгээрэй — ажилтан тантай холбогдож " +
  "нарийвчилсан хөтөлбөр, үнийн санал бэлдэнэ.";

export const DEFAULT_HOME_CUSTOM_CTA_TITLE = "Огноо тохирохгүй байна уу?";
export const DEFAULT_HOME_CUSTOM_CTA_BODY =
  "Гэр бүл, найз нөхөд, хамт олондоо зориулж өөрийн огноогоор аялал зохион байгуулж " +
  "өгнө. Хүссэн чиглэлээ хэлэхэд ажилтан хөтөлбөр, үнийн санал бэлдэнэ.";

export const DEFAULT_GIFT_TITLE = "Аялал бэлэглээрэй";
export const DEFAULT_GIFT_BODY =
  "Төрсөн өдөр, ой, баярт өдөрт зориулж аяллын бэлгийн эрхийн бичиг захиалаарай. " +
  "Тодорхой аяллаар эсвэл өөрийн сонгосон дүнгээр болно. Ажилтан тантай холбогдож " +
  "төлбөр, хүлээн авагчийн мэдээллийг тохирно.";

/**
 * Every answer describes how this site and the office actually work. Where a
 * rule depends on the trip, the airline or a country (visas, luggage,
 * refunds), the answer says where to find it instead of inventing one.
 */
export const DEFAULT_FAQS: FaqItem[] = [
  {
    topic: "Захиалга",
    q: "Хэрхэн захиалга өгөх вэ?",
    a: "Аяллын хуудсанд огноо, том хүн, хүүхэд, нярайн тоогоо сонгоод нэр, утсаа үлдээнэ. Захиалга илгээмэгц захиалгын дугаар өгөгдөж, суудал 60 минут таны нэр дээр түр хадгалагдана. Дараа нь манай ажилтан тантай холбогдож нөхцөлийг баталгаажуулна. Утас, Messenger, WhatsApp-аар шууд захиалж ч болно.",
  },
  {
    topic: "Захиалга",
    q: "Захиалга хэзээ баталгаажих вэ?",
    a: "Сайтаар илгээсэн захиалга, хүсэлт нь тэр дороо баталгаажсан захиалга биш. Ажилтан тантай холбогдож огноо, хүний тоо, үнэ, төлбөрийн нөхцөлийг тохирсны дараа баталгаажина.",
  },
  {
    topic: "Захиалга",
    q: "Онлайнаар захиалахад суудал хадгалагдах уу?",
    a: "Тийм, тухайн огнооны суудал 60 минут түр хадгалагдана. Энэ хугацаанд баталгаажаагүй бол суудал бусдад дахин нээгдэнэ — ажилтантай холбогдоод дахин тохирч болно.",
  },
  {
    topic: "Захиалга",
    q: "«Үнийн санал авах» гэж юу вэ?",
    a: "Зарим аяллын үнэ зочид буудал, багц эсвэл огнооноос хамаарч өөр байдаг. Ийм аялалд онлайн захиалгын оронд үнийн санал авах хүсэлт илгээнэ — ажилтан таны сонголтыг тодруулж эцсийн үнийг хэлнэ.",
  },
  {
    topic: "Захиалга",
    q: "Огноо тохирохгүй бол яах вэ?",
    a: "«Захиалгат аялал» хуудаснаас чиглэл, ойролцоо огноо, хүний тоогоо үлдээнэ үү. Ажилтан тантай холбогдож хөтөлбөр, үнийн санал бэлдэнэ.",
  },
  {
    topic: "Үнэ ба төлбөр",
    q: "Сайтад харагдах үнэ юуг илэрхийлдэг вэ?",
    a: "«-с эхлэн» гэсэн үнэ нь тухайн аяллын захиалга авч буй огноонуудаас хамгийн хямд нь, нэг том хүний үнэ. Огноо сонгоход тухайн өдрийн үнэ гарна. Нэмэлт төлбөр, ганц хүний өрөөний нэмэгдэл зэргийг аяллын хуудсанд тусад нь бичсэн.",
  },
  {
    topic: "Үнэ ба төлбөр",
    q: "Хүүхэд, нярайн үнэ ямар байдаг вэ?",
    a: "Насны ангилал, үнийг аялал бүрийн хуудсанд бичсэн. Хүүхэд эсвэл нярайн үнэ нийтлэгдээгүй бол сайт дүнг таамаглахгүй — ажилтан тухайн аяллын нөхцөлөөр тодруулж хэлнэ.",
  },
  {
    topic: "Үнэ ба төлбөр",
    q: "Төлбөрөө хэрхэн төлөх вэ?",
    a: "Төлбөрийн хэлбэр, хугацааг ажилтан захиалгыг баталгаажуулах үед тантай тохирно. Шилжүүлэг хийхдээ гүйлгээний утгад захиалгын дугаараа бичнэ үү.",
  },
  {
    topic: "Үнэ ба төлбөр",
    q: "Үнэд юу багтсан, юу ороогүйг хаанаас харах вэ?",
    a: "Аялал бүрийн хуудсанд «Багцад багтсан», «Багцад ороогүй» жагсаалт тусдаа бий. Виз, хувийн зардал, ганц хүний өрөөний нэмэгдэл зэрэг нь ихэвчлэн багцад ордоггүй тул заавал нягтлаарай.",
  },
  {
    topic: "Бичиг баримт ба виз",
    q: "Ямар бичиг баримт хэрэгтэй вэ?",
    a: "Гадаадад хүчинтэй паспорт хэрэгтэй. Улс бүр паспортын хүчинтэй хугацаа, хүүхдийн бичиг баримтад өөр өөр шаардлага тавьдаг тул тухайн аяллын шаардлагыг ажилтнаас баталгаажуулна уу.",
  },
  {
    topic: "Бичиг баримт ба виз",
    q: "Виз хэрэгтэй юу?",
    a: "Визийн шаардлага очих улс болон таны иргэншлээс хамаарч өөр бөгөөд өөрчлөгддөг. Аяллын хуудсанд виз багцад багтсан эсэхийг харна уу; багтаагүй бол шаардлага, бүрдүүлэх хугацааг ажилтнаас эсвэл тухайн улсын элчин сайдын яамнаас тодруулна уу.",
  },
  {
    topic: "Бичиг баримт ба виз",
    q: "Бичиг баримтыг хэн хариуцах вэ?",
    a: "Паспорт, виз болон бусад бичиг баримтаа хүчинтэй байлгах нь аялагчийн үүрэг. Дэлгэрэнгүйг «Үйлчилгээний нөхцөл»-өөс уншина уу.",
  },
  {
    topic: "Аялалд бэлтгэх",
    q: "Хэдэн кг ачаа авч болох вэ?",
    a: "Ачааны хэмжээ нислэг, агаарын тээврийн компани, тасалбарын төрлөөс хамаардаг. Тухайн аяллын ачааны нормыг ажилтнаас тодруулна уу.",
  },
  {
    topic: "Аялалд бэлтгэх",
    q: "Хаанаас, хэдэн цагт хөдлөх вэ?",
    a: "Цугларах газар, цагийг аяллын хуудасны өдөр тутмын хөтөлбөрт бичсэн. Аяллын өмнө ажилтан тантай дахин баталгаажуулна.",
  },
  {
    topic: "Аялалд бэлтгэх",
    q: "Ямар зочид буудалд буух вэ?",
    a: "Буудлын нэр, зэрэглэлийг аяллын хуудсанд бичсэн. «эсвэл адил зэрэглэлийн» гэж бичсэн бол эцсийн буудал захиалга баталгаажих үед тодорхой болно.",
  },
  {
    topic: "Аялалд бэлтгэх",
    q: "Хоол багтсан уу?",
    a: "Өдөр бүрийн хөтөлбөрт өглөө, өдөр, оройн хоол багтсан эсэхийг тусад нь тэмдэглэсэн.",
  },
  {
    topic: "Цуцлалт ба өөрчлөлт",
    q: "Захиалгаа цуцлах, өөрчлөх боломжтой юу?",
    a: "Цуцлалт, буцаалтын нөхцөл аялал бүрээр өөр. Аяллын хуудсанд цуцлалтын нөхцөл бичигдсэн бол тэнд, эс бөгөөс захиалга баталгаажих үед ажилтнаас тодруулна уу.",
  },
  {
    topic: "Холбоо барих",
    q: "Танайтай хэрхэн холбогдох вэ?",
    a: "Утас, Messenger, WhatsApp, и-мэйлээр холбогдоно. Бүх хаягийг «Холбоо барих» хуудаснаас харна уу.",
  },
  {
    topic: "Холбоо барих",
    q: "Хувийн мэдээллээ устгуулж болох уу?",
    a: "Тийм. «Хувийн мэдээлэл устгах» хуудсанд заасан аргаар хүсэлт гаргана уу.",
  },
];

export const DEFAULT_TERMS_SECTIONS: TermsSection[] = [
  {
    title: "1. Хүсэлт ба баталгаажуулалт",
    body: "Энэ сайтаар илгээсэн хүсэлт нь захиалга биш — аялал сонирхож буй хүсэлт бөгөөд суудал автоматаар хадгалагдахгүй. Хүсэлт илгээсний дараа манай ажилтан утсаар тантай холбогдож, эцсийн үнэ, огноо, нөхцөлийг тодруулсны дараа л захиалга баталгаажина.",
  },
  {
    title: "2. Төлбөр",
    body: "Энэ сайт дээр төлбөр тооцоо хийгдэхгүй. Төлбөрийн хэлбэр (бэлнээр, дансаар гэх мэт), хэмжээ, урьдчилгааны нөхцөлийг манай ажилтантай утсаар ярилцаж тохирно. Аяллын хуудсан дахь үнэ нь урьдчилсан тооцоо бөгөөд эцсийн үнийг ажилтан тодруулж хэлнэ.",
  },
  {
    title: "3. Үнэд багтах зүйл",
    body: "Аялал бүрийн хуудсанд багцад багтсан болон багтаагүй зүйлсийг тусад нь жагсаасан байна. Виз, хувийн зардал, нэмэлт үйлчилгээ нь тухайн аялалд тусгайлан заагаагүй бол багцад ороогүй болно.",
  },
  {
    title: "4. Цуцлалт ба буцаалт",
    body: "Цуцлалтын нөхцөл аялал тус бүрээр өөр байж болох тул тухайн аяллын хуудсан дахь цуцлалтын нөхцөлийг уншина уу. Төлбөр манай ажилтантай шууд тохиролцсоны үндсэн дээр хийгддэг тул цуцлалт, буцаалтын нарийвчилсан нөхцөлийг захиалга баталгаажих үед ажилтнаас тодруулна уу.",
  },
  {
    title: "5. Аялагчийн үүрэг",
    body: "Аялагч нь гадаад паспорт, виз болон бусад шаардлагатай бичиг баримтаа хүчинтэй эсэхийг өөрөө хариуцна. Бичиг баримтын дутагдлаас үүдэн аялалд оролцох боломжгүй болсон тохиолдолд төлбөр буцаагдахгүй.",
  },
  {
    title: "6. Хувийн мэдээлэл",
    body: "Захиалгын явцад цуглуулсан мэдээллийг зөвхөн аяллын зохион байгуулалт, холбоо барих зорилгоор ашиглана. Гуравдагч этгээдэд аяллын үйлчилгээ үзүүлэхэд шаардлагатайгаас бусад тохиолдолд дамжуулахгүй.",
  },
];

/** Validates and clamps an admin-submitted FAQ list — never trust JSON off the wire. */
export function parseFaqs(value: unknown): FaqItem[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      q: typeof item.q === "string" ? item.q.trim().slice(0, 200) : "",
      a: typeof item.a === "string" ? item.a.trim().slice(0, 2000) : "",
      ...(typeof item.topic === "string" && item.topic.trim() ? { topic: item.topic.trim().slice(0, 60) } : {}),
    }))
    .filter((item) => item.q || item.a)
    .slice(0, 40);
}

/** Validates and clamps admin-submitted terms sections — never trust JSON off the wire. */
export function parseTermsSections(value: unknown): TermsSection[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      title: typeof item.title === "string" ? item.title.trim().slice(0, 200) : "",
      body: typeof item.body === "string" ? item.body.trim().slice(0, 4000) : "",
    }))
    .filter((item) => item.title || item.body)
    .slice(0, 30);
}
