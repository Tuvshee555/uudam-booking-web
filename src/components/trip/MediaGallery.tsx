"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink } from "lucide-react";

import { isAllowedImageHost } from "@/lib/imageHosts";
import { mediaKind, youtubeEmbed, type MediaItem } from "@/lib/media";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

function linkLabel(item: MediaItem) {
  if (item.caption) return item.caption;
  try {
    return new URL(item.url).hostname.replace(/^www\./, "");
  } catch {
    return "Холбоос";
  }
}

function Photo({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
  // next/image refuses hosts outside remotePatterns, and a pasted hotel photo
  // can come from anywhere — fall back to a plain <img> rather than crash.
  if (isAllowedImageHost(src)) {
    return <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />;
}

/** Photos, videos and links staff attached to one part of a trip (hotel, travelers). */
export default function MediaGallery({ items, title }: { items: MediaItem[]; title: string }) {
  const [enlarged, setEnlarged] = useState<MediaItem | null>(null);

  const visual = items.filter((item) => mediaKind(item.url) !== "link");
  const links = items.filter((item) => mediaKind(item.url) === "link");

  return (
    <div>
      {visual.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visual.map((item, index) => {
            const kind = mediaKind(item.url);
            const embed = kind === "youtube" ? youtubeEmbed(item.url) : null;

            return (
              <figure
                key={`${item.url}-${index}`}
                className={kind === "image" ? "" : "col-span-2"}
              >
                {kind === "image" ? (
                  <button
                    type="button"
                    onClick={() => setEnlarged(item)}
                    className="relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-secondary"
                    aria-label={item.caption || `${title} — зураг томруулах`}
                  >
                    <Photo src={item.url} alt={item.caption || title} sizes="(max-width: 640px) 50vw, 33vw" />
                  </button>
                ) : embed ? (
                  <div className="aspect-video overflow-hidden rounded-xl bg-black">
                    <iframe
                      src={embed}
                      title={item.caption || `${title} — бичлэг`}
                      className="h-full w-full"
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="aspect-video overflow-hidden rounded-xl bg-black">
                    <video
                      src={item.url}
                      controls
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
                {item.caption && (
                  <figcaption className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{item.caption}</figcaption>
                )}
              </figure>
            );
          })}
        </div>
      )}

      {links.length > 0 && (
        <div className={visual.length > 0 ? "mt-4 flex flex-wrap gap-2" : "flex flex-wrap gap-2"}>
          {links.map((item, index) => (
            <a
              key={`${item.url}-${index}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
              {linkLabel(item)}
            </a>
          ))}
        </div>
      )}

      <Dialog open={enlarged !== null} onOpenChange={(open) => !open && setEnlarged(null)}>
        <DialogContent className="max-w-4xl p-2">
          <DialogTitle className="sr-only">{enlarged?.caption || title}</DialogTitle>
          {enlarged && (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
              {isAllowedImageHost(enlarged.url) ? (
                <Image src={enlarged.url} alt={enlarged.caption || title} fill sizes="90vw" className="object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={enlarged.url} alt={enlarged.caption || title} className="h-full w-full object-contain" />
              )}
            </div>
          )}
          {enlarged?.caption && <p className="px-2 pb-1 text-sm text-muted-foreground">{enlarged.caption}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
