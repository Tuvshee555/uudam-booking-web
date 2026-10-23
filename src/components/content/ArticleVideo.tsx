import { ExternalLink, Play } from "lucide-react";

import { extractUrl, mediaKind, youtubeEmbed } from "@/lib/media";

/** "…watch?v=ID&t=2067s" → 2067, so the player opens where the link pointed. */
function startSeconds(url: string): number | null {
  const match = url.match(/[?&](?:t|start)=(\d+)s?(?:&|#|$)/);
  return match ? Number(match[1]) : null;
}

/**
 * The video on an article. It was always a bare `<video src>`, which cannot
 * play a YouTube page link: the browser blocked the request and visitors got
 * an empty black player. YouTube links are embedded, real video files get a
 * player, and anything else becomes a plain link rather than a dead box.
 */
export default function ArticleVideo({ url, title }: { url: string; title: string }) {
  const clean = extractUrl(url) ?? url.trim();
  const kind = mediaKind(clean);

  if (kind === "youtube") {
    const start = startSeconds(clean);
    return (
      <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl bg-black">
        <iframe
          src={`${youtubeEmbed(clean)}${start ? `?start=${start}` : ""}`}
          title={`${title} — бичлэг`}
          loading="lazy"
          className="h-full w-full"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl bg-black">
        <video src={clean} controls playsInline preload="metadata" className="h-full w-full" />
      </div>
    );
  }

  return (
    <a
      href={clean}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-primary hover:bg-secondary"
    >
      <Play className="h-4 w-4" />
      Бичлэг үзэх
      <ExternalLink className="h-3.5 w-3.5 opacity-70" />
    </a>
  );
}
