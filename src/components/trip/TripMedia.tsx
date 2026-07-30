"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

import { recordVideoPlay } from "@/lib/analytics";
import type { Trip } from "@/types/trip";
import { cn } from "@/lib/utils";

type Slide =
  | { kind: "image"; src: string }
  | { kind: "video"; src: string };

/**
 * Turn a video URL into something embeddable. Agencies paste YouTube links as
 * often as they upload files, and a raw YouTube watch URL in a <video> tag
 * renders nothing at all.
 */
function youtubeEmbed(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export default function TripMedia({ trip }: { trip: Trip }) {
  const slides = useMemo<Slide[]>(() => {
    const videos = [trip.video, ...trip.videos].filter(
      (src): src is string => typeof src === "string" && src.trim().length > 0,
    );
    const images = [trip.image, ...trip.extraImages].filter(
      (src): src is string => typeof src === "string" && src.trim().length > 0,
    );

    return [
      ...images.map((src) => ({ kind: "image" as const, src })),
      ...videos.map((src) => ({ kind: "video" as const, src })),
    ];
  }, [trip]);

  const [active, setActive] = useState(0);
  const current = slides[active];

  if (!current) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-secondary text-sm text-muted-foreground">
        Зураг байхгүй
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-secondary">
        {current.kind === "image" ? (
          <Image
            src={current.src}
            alt={trip.title}
            fill
            sizes="(max-width: 1024px) 100vw, 66vw"
            className="object-cover"
            priority
          />
        ) : youtubeEmbed(current.src) ? (
          <iframe
            src={youtubeEmbed(current.src)!}
            title={`${trip.title} бичлэг`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            src={current.src}
            controls
            playsInline
            preload="metadata"
            onPlay={recordVideoPlay}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      {slides.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {slides.map((slide, index) => (
            <button
              key={`${slide.kind}-${slide.src}-${index}`}
              type="button"
              onClick={() => {
                setActive(index);
                if (slide.kind === "video") recordVideoPlay();
              }}
              className={cn(
                "relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 bg-secondary transition-colors",
                index === active ? "border-primary" : "border-transparent hover:border-border",
              )}
              aria-label={`${index + 1}-р медиа`}
            >
              {slide.kind === "image" ? (
                <Image src={slide.src} alt="" fill sizes="96px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-navy-deep text-white">
                  <Play className="h-5 w-5 fill-current" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
