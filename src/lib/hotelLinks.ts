export type HotelLink = {
  name: string;
  url: string;
};

export type HotelProfile = HotelLink & {
  description: string;
  media: Array<{ url: string; caption: string }>;
  /** The chatbot's id for this hotel, when it wrote one; price rows link to it by `hotel_profile_ids`. */
  id?: string;
};

/** A hotel card on the trip page, with the price options it is sold in ("A + B", "B"). */
export type StayHotel = HotelProfile & {
  soldIn: string[];
};

export type HotelTextSegment = {
  text: string;
  url?: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function safeHotelUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function hotelMedia(value: unknown): HotelProfile["media"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const item = record(entry);
    const url = safeHotelUrl(item.url);
    if (!url) return [];
    return [{
      url: url.slice(0, 1000),
      caption: typeof item.caption === "string" ? item.caption.trim().slice(0, 200) : "",
    }];
  }).slice(0, 30);
}

export function hotelLinksFromMetadata(metadata: Record<string, unknown> | null | undefined): HotelLink[] {
  const raw = metadata?.hotel_links;
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  return raw.flatMap((value) => {
    const item = record(value);
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const url = safeHotelUrl(item.url);
    const key = name.toLocaleLowerCase();
    if (!name || !url || seen.has(key)) return [];
    seen.add(key);
    return [{ name, url }];
  });
}

/**
 * The hotels staff actually described: `hotel_profiles`, else the older
 * `hotel_links` (legacy `Trip.hotelMedia` belongs to the first of those).
 * Never the plain `Trip.hotel` text — that is a label, not a profile.
 */
export function declaredHotelProfiles(
  metadata: Record<string, unknown> | null | undefined,
  legacyMedia: unknown,
): HotelProfile[] {
  const raw = metadata?.hotel_profiles;
  if (Array.isArray(raw)) {
    const profiles = raw.flatMap((value): HotelProfile[] => {
      const item = record(value);
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!name) return [];
      const id = typeof item.id === "string" ? item.id.trim() : "";
      return [{
        name,
        url: safeHotelUrl(item.url) ?? "",
        description: typeof item.description === "string" ? item.description.trim() : "",
        media: hotelMedia(item.media),
        ...(id ? { id } : {}),
      }];
    });
    if (profiles.length) return profiles;
  }

  const links = hotelLinksFromMetadata(metadata);
  if (!links.length) return [];
  const media = hotelMedia(legacyMedia);
  return links.map((link, index) => ({
    ...link,
    description: "",
    media: index === 0 ? media : [],
  }));
}

export function hotelProfilesFromData(
  metadata: Record<string, unknown> | null | undefined,
  hotel: string | null | undefined,
  legacyMedia: unknown,
): HotelProfile[] {
  const declared = declaredHotelProfiles(metadata, legacyMedia);
  if (declared.length) return declared;
  const name = hotel?.trim();
  return name ? [{ name, url: "", description: "", media: hotelMedia(legacyMedia) }] : [];
}

/** "Example Bay+Example Garden" reads "Example Bay + Example Garden". Display only. */
export function formatHotelName(name: string): string {
  return name.replace(/\s*\+\s*/g, " + ").replace(/\s+/g, " ").trim();
}

/**
 * One stay that names several hotels ("A+B", "A / B", "A эсвэл B") becomes its
 * hotels, with the same separators as the chatbot's hotelOptionParts;
 * "эсвэл" / "or" is Uudam's "A or B" hotel rule. "&", an unspaced "/" and a
 * comma are NOT separators: they are part of real names ("Altara Resort & Spa",
 * "Example Bay, Old Town"). A part that names no hotel ("адил зэрэглэлийн
 * буудал", "similar") is dropped when the stay has a real hotel beside it.
 */
export function splitHotelNames(value: string): string[] {
  const parts = value
    .split(/\s*[+＋]\s*|\s+\/\s+|\s+(?:эсвэл|or)\s+/iu)
    .map((part) => part.trim())
    .filter(Boolean);
  const named = parts.filter((part) => hotelTokens(part).length > 0);
  return named.length ? named : parts;
}

// Words every hotel name may carry, and the words of "or a similar hotel";
// a match on these alone is no match, and a part made only of them is no hotel.
/** Accents off, lower case. NFKD turns "й" into "и" + a mark, so the word list is folded the same way. */
function foldName(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}+/gu, "").toLocaleLowerCase();
}

const GENERIC_HOTEL_WORDS = new Set([
  "hotel", "hotels", "resort", "resorts", "spa", "inn", "the", "and", "by", "of", "a", "an",
  "similar", "same", "equivalent", "or",
  "зочид", "буудал", "буудлын", "буудалд", "буудлууд", "ба", "болон", "адил", "зэрэглэлийн", "эсвэл",
  "түүнтэй", "үүнтэй", "ижил", "төстэй", "төсөөтэй", "зэрэглэл", "зэргийн", "ангиллын", "түвшний",
].map(foldName));

function hotelTokens(name: string): string[] {
  return foldName(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token && !GENERIC_HOTEL_WORDS.has(token));
}

function tokenRuns(tokens: string[]): Set<string> {
  const runs = new Set<string>();
  for (let start = 0; start < tokens.length; start += 1) {
    let joined = "";
    for (let end = start; end < tokens.length; end += 1) {
      joined += tokens[end];
      runs.add(joined);
    }
  }
  return runs;
}

/**
 * How well a short hotel name in a price row names a full profile.
 * 3 = the same name written differently ("Velt Crown" / "Veltcrown");
 * 2 = one name is the other's words ("Norvel" / "Norvel Island Resort");
 * 0 = different hotels. Generic words ("Hotel", "Resort") never match alone.
 */
function tokensWithin(short: string[], long: string[]): boolean {
  return short.every((token) => long.includes(token)) || tokenRuns(long).has(short.join(""));
}

export function hotelNameMatchScore(left: string, right: string): number {
  const a = hotelTokens(left);
  const b = hotelTokens(right);
  if (!a.length || !b.length) return 0;
  if (a.join("") === b.join("")) return 3;
  return tokensWithin(a, b) || tokensWithin(b, a) ? 2 : 0;
}

/** True when every word of `short` belongs to `long` ("Norvel" within "Norvel Island Resort"). */
function nameWithin(short: string, long: string): boolean {
  const a = hotelTokens(short);
  return a.length > 0 && tokensWithin(a, hotelTokens(long));
}

/**
 * The profile a price row's hotel name refers to, by the chatbot's rule
 * (partnerSync/hotelProfiles.ts matchHotelProfile), so both sides link a row to
 * the same hotel. The whole name's key first, generic words kept: "Norvel
 * Resort" is not "Norvel Hotel", and two profiles of that key are no answer.
 * Then exactly one profile that fits by its words, and only by the start of
 * the name: a shorter spelling ("Norvel" for "Norvel Grand"), or the profile's
 * whole name starting a longer one with no joiner after it. "Norvel Garden
 * Lodge" is not "Norvel Hotel", "Crown" is not "Velt Crown", and "Norvel
 * Beach, Tavrin Morrow" names two hotels, not Norvel Beach.
 */
export function matchHotelProfile<T extends HotelLink>(name: string, profiles: T[]): T | null {
  const key = hotelKey(name);
  if (key.length < MIN_KEY_LENGTH) return null;
  const same = profiles.filter((profile) => hotelKey(profile.name) === key);
  if (same.length) return same.length === 1 ? same[0] : null;
  const fits = profiles.filter((profile) => hotelNameMatchScore(name, profile.name) >= 2);
  return fits.length === 1 && startsAlike(name, fits[0].name) ? fits[0] : null;
}

/** The chatbot's MIN_KEY_LENGTH: a name of fewer letters is no hotel. */
const MIN_KEY_LENGTH = 3;

/** Signs and words that join two hotels in one text: the chatbot's LIST_JOINER (partnerSync/hotelProfiles.ts). */
const LIST_JOINER = /[,;&/+＋]|(?:^|[^\p{L}\p{N}])(?:эсвэл|буюу|болон|ба|or|and)(?=$|[^\p{L}\p{N}])/iu;

/**
 * What is left of `long` after the words that spell `short` from its start ("Norvel Grand" in
 * "Norvel Grand Hotel" leaves " Hotel"), or null when `short` is not the start of `long`:
 * the chatbot's startRemainder.
 */
function startRemainder(short: string, long: string): string | null {
  const key = hotelKey(short);
  if (!key) return null;
  const source = long.normalize("NFKC");
  let prefix = "";
  for (const word of source.matchAll(/[\p{L}\p{N}]+/gu)) {
    prefix += word[0].toLocaleLowerCase();
    if (prefix === key) return source.slice((word.index ?? 0) + word[0].length);
    if (prefix.length >= key.length) return null;
  }
  return null;
}

/**
 * The chatbot's startsAlike: `name` is a shorter spelling of the profile, or the profile's whole
 * name starts `name` and nothing after it joins a second hotel. The chatbot's extra "the rest
 * starts like another profile" check is not needed here: any other profile whose words are in
 * `name` is a second fit, and two fits are already no answer.
 */
function startsAlike(name: string, profileName: string): boolean {
  if (startRemainder(name, profileName) !== null) return true;
  const rest = startRemainder(profileName, name);
  return rest !== null && !LIST_JOINER.test(rest);
}

/** A priced hotel option ("A+B") and the profile ids the chatbot linked it to, if any. */
export type PricedHotel = { label: string; profileIds?: string[] };

/** The chatbot's hotelKey: "Norvel Grand", "norvel-grand" and "NORVELGRAND" are one key. */
function hotelKey(name: string): string {
  return name.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** The ids a price row may name this profile by: its own id, else (as the chatbot does) its name's key. */
function profileIdMatches(profile: HotelProfile, id: string): boolean {
  return Boolean(id) && (profile.id === id || hotelKey(profile.name) === id);
}

/** Folded words joined by single spaces, generic words kept: "Norvel Beach-Hotel" reads "norvel beach hotel". */
function spelledWords(value: string): string {
  return foldName(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * The declared hotels a part names in full, when it names two or more and nothing
 * else: every word of each profile's name in order, generic words included, and no
 * other hotel word left over. Anything less is no answer: a part's distinctive
 * words alone ("Norvel" of "Norvel Resort") can belong to another hotel
 * ("Norvel Lagoon"), and a hotel the part names beside them must not vanish.
 */
function spelledProfiles(part: string, declared: HotelProfile[]): HotelProfile[] {
  const text = ` ${spelledWords(part)} `;
  const names = declared
    .map((profile) => ({ profile, words: spelledWords(profile.name) }))
    .filter((entry, index, list) => entry.words && text.includes(` ${entry.words} `)
      && list.findIndex((other) => other.words === entry.words) === index);
  // "Norvel Beach" inside a spelled "Norvel Beach Villas" is that one hotel, not two.
  const found = names.filter((entry) => !names.some((other) => other !== entry
    && other.words.length > entry.words.length && ` ${other.words} `.includes(` ${entry.words} `)));
  if (found.length < 2) return [];
  let rest = text;
  for (const { words } of found) rest = rest.split(` ${words} `).join("  ");
  if (hotelTokens(rest).length) return [];
  return found
    .sort((left, right) => text.indexOf(` ${left.words} `) - text.indexOf(` ${right.words} `))
    .map((entry) => entry.profile);
}

/** The profiles one priced option stays at, part by part; null where a part has no profile. */
function optionProfiles(option: Required<PricedHotel>, declared: HotelProfile[]): Array<{ part: string; profile: HotelProfile | null }> {
  const parts = splitHotelNames(option.label);
  const linked = option.profileIds.flatMap((id) => {
    const profile = declared.find((entry) => profileIdMatches(entry, id));
    return profile ? [profile] : [];
  }).filter((profile, index, list) => list.indexOf(profile) === index);
  // Every hotel of the option linked by id, in the option's own order: the chatbot's link wins.
  if (linked.length && linked.length === option.profileIds.length && linked.length === parts.length) {
    return parts.map((part, index) => ({ part, profile: linked[index] }));
  }
  const resolve = (part: string) => matchHotelProfile(part, linked) ?? matchHotelProfile(part, declared);
  const pairs = parts.flatMap((part): Array<{ part: string; profile: HotelProfile | null }> => {
    // "A эсвэл B, C эсвэл D": the two cities' hotels are joined by a comma, so the middle
    // part is "B, C". A comma is normally part of a name ("Example Bay, Old Town"), so
    // the part splits on it only when every piece is a different declared hotel. Tried
    // before a partial fit of the whole part, which can fit C alone and so lose B
    // ("Norvel Beach" written short for "Norvel Beach Lagoon"); a profile of exactly
    // that name still wins.
    const profile = resolve(part);
    if (profile && hotelKey(part) === hotelKey(profile.name)) return [{ part, profile }];
    const pieces = part.split(/\s*,\s+/).map((piece) => piece.trim()).filter(Boolean);
    if (pieces.length > 1) {
      const found = pieces.map((piece) => ({ part: piece, profile: resolve(piece) }));
      const distinct = new Set(found.map((entry) => entry.profile));
      if (found.every((entry) => entry.profile) && distinct.size === found.length) return found;
    }
    if (profile) return [{ part, profile }];
    // A part that still fits no one profile but spells out two or more declared hotels'
    // full names ("B - C") is those hotels, never a combined name-only card beside them.
    const spelled = spelledProfiles(part, declared);
    return spelled.length ? spelled.map((entry) => ({ part, profile: entry })) : [{ part, profile: null }];
  });
  // One part left without a profile and one linked profile left unused: the id says which it is.
  const unusedLinked = linked.filter((profile) => !pairs.some((pair) => pair.profile === profile));
  const unmatched = pairs.filter((pair) => !pair.profile);
  if (unusedLinked.length === 1 && unmatched.length === 1) unmatched[0].profile = unusedLinked[0];
  return pairs;
}

/**
 * True when a day's accommodation text names this profile ("Example Transit Inn-д хоноглоно"):
 * the profile's whole name, generic words included. Its distinctive words alone ("Norvel" of
 * "Norvel Hotel") are another hotel's too ("Norvel Garden Lodge-д хоноглоно").
 */
function namedInText(profile: HotelProfile, texts: string[], declared: HotelProfile[]): boolean {
  const words = spelledWords(profile.name);
  return texts.some((value) => (words.length > 0 && ` ${spelledWords(value)} `.includes(` ${words} `))
    || splitHotelNames(value).some((part) => matchHotelProfile(part, declared) === profile));
}

export type StayHotelSection = {
  hotels: StayHotel[];
  /** Older trip-level hotel photos (Trip.hotelMedia) that belong to no one card; shown under the cards. */
  sharedMedia: HotelProfile["media"];
};

/**
 * The trip page's hotel section, from the hotels the trip is sold with.
 *
 * Each priced hotel option ("A+B", "B") is split into its hotels. A hotel
 * follows the profile ids the chatbot wrote on the row first, else is matched
 * to a profile by name; a priced hotel with no profile is a card with just its
 * name. A declared profile no price row links still shows when an itinerary day
 * names it (a fixed stop-over or second-city hotel), or when no row links any
 * profile at all (names spelled in another script). It is left out only when
 * other profiles were linked and nothing on the trip names it — a hotel the
 * trip does not sell. Trips priced without hotels keep every declared profile.
 * Older Trip.hotelMedia photos, when no profile carries photos, go on the one
 * hotel they can belong to, else under the cards as a shared gallery.
 */
export function stayHotelSection(
  metadata: Record<string, unknown> | null | undefined,
  hotel: string | null | undefined,
  legacyMedia: unknown,
  priced: Array<string | PricedHotel>,
  accommodations: Array<string | null | undefined> = [],
): StayHotelSection {
  const options = priced
    .map((entry) => typeof entry === "string" ? { label: entry, profileIds: [] } : { label: entry.label, profileIds: entry.profileIds ?? [] })
    .filter((option) => option.label.trim());
  if (!options.length) {
    return { hotels: hotelProfilesFromData(metadata, hotel, legacyMedia).map((profile) => ({ ...profile, soldIn: [] })), sharedMedia: [] };
  }
  const declared = declaredHotelProfiles(metadata, legacyMedia);
  const cards: Array<StayHotel & { source: HotelProfile | null }> = [];
  const cardOf = (profile: HotelProfile | null, part: string) => {
    const existing = cards.find((card) => profile ? card.source === profile : !card.source && hotelKey(card.name) === hotelKey(part));
    if (existing) return existing;
    const created = profile
      ? { ...profile, media: [...profile.media], soldIn: [] as string[], source: profile }
      : { name: part, url: "", description: "", media: [] as HotelProfile["media"], soldIn: [] as string[], source: null };
    cards.push(created);
    return created;
  };
  for (const option of options) {
    const shown = formatHotelName(option.label);
    for (const { part, profile } of optionProfiles(option, declared)) {
      const card = cardOf(profile, part);
      if (!card.soldIn.includes(shown)) card.soldIn.push(shown);
    }
  }
  const anyLinked = cards.some((card) => card.source);
  const texts = accommodations.flatMap((value) => typeof value === "string" && value.trim() ? [value] : []);
  for (const profile of declared) {
    if (cards.some((card) => card.source === profile)) continue;
    if (!anyLinked || namedInText(profile, texts, declared)) cards.push({ ...profile, media: [...profile.media], soldIn: [], source: profile });
  }

  // declaredHotelProfiles already gave legacy photos to the first hotel link; with no
  // profile or link at all they are the trip's only hotel photos and must not vanish.
  let sharedMedia: HotelProfile["media"] = [];
  const legacy = declared.length ? [] : hotelMedia(legacyMedia);
  if (legacy.length) {
    const named = hotel?.trim() ? cards.filter((card) => hotelKey(card.name) === hotelKey(hotel)) : [];
    const owner = cards.length === 1 ? cards[0] : named.length === 1 ? named[0] : null;
    if (owner) owner.media = [...owner.media, ...legacy];
    else sharedMedia = legacy;
  }
  return {
    hotels: cards.map((card) => ({
      name: card.name,
      url: card.url,
      description: card.description,
      media: card.media,
      soldIn: card.soldIn,
    })),
    sharedMedia,
  };
}

/** The hotel cards alone; the trip page uses stayHotelSection so shared photos are shown too. */
export function stayHotels(
  metadata: Record<string, unknown> | null | undefined,
  hotel: string | null | undefined,
  legacyMedia: unknown,
  priced: Array<string | PricedHotel>,
  accommodations: Array<string | null | undefined> = [],
): StayHotel[] {
  return stayHotelSection(metadata, hotel, legacyMedia, priced, accommodations).hotels;
}

/**
 * Links for hotel names written in itinerary days and price rows. Every
 * profile with a link, plus the short names the trip actually uses for it
 * ("Sarnai" for "Sarnai Island Resort Example Bay"), so a day that says only
 * "Sarnai" still links to that hotel's page.
 */
export function hotelLinkTargets(profiles: HotelLink[], namesInUse: Array<string | null | undefined>): HotelLink[] {
  const linked = profiles.filter((profile) => profile.url).map(({ name, url }) => ({ name, url }));
  const targets: HotelLink[] = [...linked];
  for (const value of namesInUse) {
    for (const part of splitHotelNames(value ?? "")) {
      if (targets.some((target) => target.name.toLocaleLowerCase() === part.toLocaleLowerCase())) continue;
      const profile = matchHotelProfile(part, linked);
      // Only a SHORTER way of writing the hotel becomes a link: a day text that
      // names two hotels must never link as a whole to one of them.
      if (profile && nameWithin(part, profile.name)) targets.push({ name: part, url: profile.url });
    }
  }
  return targets;
}

/** Split accommodation copy while preserving its original punctuation and wording. */
export function hotelTextSegments(text: string, links: HotelLink[]): HotelTextSegment[] {
  const matches = links
    .flatMap((link) => {
      const start = text.toLocaleLowerCase().indexOf(link.name.toLocaleLowerCase());
      return start < 0 ? [] : [{ start, end: start + link.name.length, url: link.url }];
    })
    .sort((left, right) => left.start - right.start || right.end - left.end);

  const segments: HotelTextSegment[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    if (match.start > cursor) segments.push({ text: text.slice(cursor, match.start) });
    segments.push({ text: text.slice(match.start, match.end), url: match.url });
    cursor = match.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments.length ? segments : [{ text }];
}
