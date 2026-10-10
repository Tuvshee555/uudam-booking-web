export type HotelLink = {
  name: string;
  url: string;
};

export type HotelProfile = HotelLink & {
  description: string;
  media: Array<{ url: string; caption: string }>;
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

export function hotelProfilesFromData(
  metadata: Record<string, unknown> | null | undefined,
  hotel: string | null | undefined,
  legacyMedia: unknown,
): HotelProfile[] {
  const raw = metadata?.hotel_profiles;
  if (Array.isArray(raw)) {
    const profiles = raw.flatMap((value) => {
      const item = record(value);
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!name) return [];
      return [{
        name,
        url: safeHotelUrl(item.url) ?? "",
        description: typeof item.description === "string" ? item.description.trim() : "",
        media: hotelMedia(item.media),
      }];
    });
    if (profiles.length) return profiles;
  }

  const links = hotelLinksFromMetadata(metadata);
  if (links.length) {
    const media = hotelMedia(legacyMedia);
    return links.map((link, index) => ({
      ...link,
      description: "",
      media: index === 0 ? media : [],
    }));
  }

  const name = hotel?.trim();
  return name ? [{ name, url: "", description: "", media: hotelMedia(legacyMedia) }] : [];
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
