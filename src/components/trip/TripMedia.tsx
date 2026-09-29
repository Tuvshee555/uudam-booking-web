"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

import { recordVideoPlay } from "@/lib/analytics";
import { extractUrl, youtubeEmbed } from "@/lib/media";
import type { Trip } from "@/types/trip";
import { cn } from "@/lib/utils";

type Slide =
  | { kind: "image"; src: string }
  | { kind: "video"; src: string };

export default function TripMedia({ trip }: { trip: Trip }) {
  const slides = useMemo<Slide[]>(() => {
    // extractUrl, not the raw value: a stored video can carry a label typed
    // in front of the link ("зочид буудал - https://…"), which <video src>
    // plays as nothing.
    const videos = [trip.video, ...trip.videos]
      .map(extractUrl)
      .filter((src): src is string => Boolean(src));
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

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActive((currentIndex) => {
        for (let step = 1; step <= slides.length; step += 1) {
          const next = (currentIndex + step) % slides.length;
          if (slides[next]?.kind === "image") return next;
        }
        return currentIndex;
      });
    }, 6500);
    return () => window.clearInterval(timer);
  }, [slides]);

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
            quality={90}
            className="uudam-hero-kenburns object-cover"
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
                <Image src={slide.src} alt="" fill sizes="96px" quality={85} className="object-cover transition-transform duration-500 hover:scale-110" />
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
