export type HotelLink = {
  name: string;
  url: string;
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
