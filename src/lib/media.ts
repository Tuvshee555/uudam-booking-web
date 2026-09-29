/**
 * Media items staff attach to a trip beyond the main gallery — hotel photos,
 * hotel videos, a link to the hotel's own site, travelers' photos and clips.
 * One shape for all of them: the kind is read off the URL, so staff paste or
 * upload anything and never have to pick "is this a video or a photo".
 */
export type MediaItem = { url: string; caption: string };

export type MediaKind = "youtube" | "video" | "image" | "link";

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/;

/**
 * The first http(s) URL inside whatever was typed into a URL box, or null.
 *
 * Staff label links inline — a live trip had its video stored as
 * "зочид буудал - https://…/video.mp4", which a <video src> plays as nothing
 * at all. Every video/media URL goes through this before it is stored or
 * rendered, so a label typed in front of a link can't break playback again.
 */
export function extractUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = raw.match(URL_PATTERN);
  if (!match) return null;
  return match[0].replace(/[),.;]+$/, "");
}

/** True when the box holds text that is not just a link (a typed label, a stray word). */
export function hasTextAroundUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("/")) return false;
  const url = extractUrl(trimmed);
  return url === null || url !== trimmed;
}

export function youtubeEmbed(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export function mediaKind(url: string): MediaKind {
  if (youtubeEmbed(url)) return "youtube";

  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    // relative or malformed — fall through to the extension checks
  }
  const lower = pathname.toLowerCase();

  if (lower.includes("/video/upload/") || /\.(mp4|webm|mov|m4v|ogv)$/.test(lower)) return "video";
  if (lower.includes("/image/upload/") || /\.(jpe?g|png|webp|gif|avif)$/.test(lower)) return "image";
  if (url.includes("images.unsplash.com")) return "image";
  return "link";
}

/**
 * Validates and cleans an admin-submitted media list. When a URL box held a
 * label in front of the link and no caption was given, the label becomes the
 * caption rather than being thrown away.
 */
export function parseMediaItems(value: unknown): MediaItem[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const items: MediaItem[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const rawUrl = typeof record.url === "string" ? record.url : "";
    const url = extractUrl(rawUrl);
    if (!url) continue;

    let caption = typeof record.caption === "string" ? record.caption.trim() : "";
    if (!caption) {
      caption = rawUrl.replace(url, "").replace(/^[\s\-–—:|,]+|[\s\-–—:|,]+$/g, "").trim();
    }

    items.push({ url: url.slice(0, 1000), caption: caption.slice(0, 200) });
  }
  return items.slice(0, 30);
}
