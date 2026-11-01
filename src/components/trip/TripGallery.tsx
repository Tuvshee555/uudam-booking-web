"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Grid2X2, Play, X } from "lucide-react";

import { recordVideoPlay } from "@/lib/analytics";
import { extractUrl, youtubeEmbed } from "@/lib/media";
import { photoAlt } from "@/lib/photoCredits";
import { tripGalleryImages } from "@/lib/tripMedia";
import { formatTripTitle } from "@/lib/tripDisplay";
import type { Trip } from "@/types/trip";
import { cn } from "@/lib/utils";

type Slide = { kind: "image"; src: string; alt: string } | { kind: "video"; src: string; alt: string };

function Lightbox({
  slides,
  index,
  onIndex,
  open,
  onOpenChange,
}: {
  slides: Slide[];
  index: number;
  onIndex: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const count = slides.length;
  const go = useCallback((delta: number) => onIndex((index + delta + count) % count), [index, count, onIndex]);
  const slide = slides[index];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-[hsl(var(--uudam-night)/0.96)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-0 z-[71] flex flex-col text-white focus:outline-none" aria-describedby={undefined}>
          <DialogPrimitive.Title className="sr-only">Аяллын зураг</DialogPrimitive.Title>
          <div className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-6">
            <span className="text-[13px] tabular-nums text-white/70" aria-live="polite">{index + 1} / {count}</span>
            <DialogPrimitive.Close className="flex h-11 w-11 items-center justify-center rounded-full text-white/85 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" aria-label="Хаах">
              <X className="h-6 w-6" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-20">
            {slide?.kind === "image" ? (
              <div className="relative h-full w-full">
                <Image src={slide.src} alt={slide.alt} fill sizes="100vw" quality={85} className="object-contain" />
              </div>
            ) : slide && youtubeEmbed(slide.src) ? (
              <iframe src={youtubeEmbed(slide.src)!} title={slide.alt} className="aspect-video w-full max-w-5xl" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            ) : slide ? (
              <video src={slide.src} controls playsInline autoPlay onPlay={recordVideoPlay} className="max-h-full w-full max-w-5xl" />
            ) : null}
            {count > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Өмнөх зураг" className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:left-5">
                  <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Дараагийн зураг" className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:right-5">
                  <ChevronRight className="h-6 w-6" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          <p className="shrink-0 px-6 py-4 text-center text-[13px] text-white/70">{slide?.alt}</p>
          {count > 1 && (
            <div className="no-scrollbar hidden shrink-0 gap-2 overflow-x-auto px-6 pb-5 sm:flex sm:justify-center">
              {slides.map((entry, position) => (
                <button
                  key={`${entry.src}-${position}`}
                  type="button"
                  onClick={() => onIndex(position)}
                  aria-label={`${position + 1}-р зураг`}
                  aria-current={position === index}
                  className={cn("relative h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold", position === index ? "border-gold" : "border-transparent opacity-60 hover:opacity-100")}
                >
                  {entry.kind === "image" ? (
                    <Image src={entry.src} alt="" fill sizes="80px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-white/10"><Play className="h-5 w-5 fill-current" aria-hidden="true" /></span>
                  )}
                </button>
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * The trip's photographs: an editorial mosaic on wide screens, a swipeable
 * full-width strip on phones, and a lightbox with every photo and video.
 * Order: cover, extra photos, then each day's photo (duplicates dropped).
 */
export default function TripGallery({ trip }: { trip: Trip }) {
  const title = formatTripTitle(trip.title);
  const slides = useMemo<Slide[]>(() => {
    const videos = [trip.video, ...trip.videos]
      .map(extractUrl)
      .filter((src): src is string => Boolean(src));
    return [
      ...tripGalleryImages(trip).map((src) => ({ kind: "image" as const, src, alt: photoAlt(trip, src, title) })),
      ...videos.map((src, position) => ({ kind: "video" as const, src, alt: `${title} — бичлэг ${position + 1}` })),
    ];
  }, [trip, title]);
  const images = slides.filter((slide) => slide.kind === "image");
  const firstVideo = slides.findIndex((slide) => slide.kind === "video");

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(0);
  const show = (position: number) => {
    setIndex(position);
    setOpen(true);
    if (slides[position]?.kind === "video") recordVideoPlay();
  };

  if (!slides.length) {
    return <div className="flex aspect-[16/9] items-center justify-center rounded-xl bg-sand text-sm text-muted-foreground">Зураг удахгүй нэмэгдэнэ</div>;
  }

  // Wide screens show a lead photo with four (or two) beside it; the rest are
  // a tap away in the lightbox.
  const mosaicCount = images.length >= 5 ? 5 : images.length >= 3 ? 3 : images.length;
  const layout =
    mosaicCount === 5 ? "lg:grid-cols-4 lg:grid-rows-2" : mosaicCount === 3 ? "lg:grid-cols-3 lg:grid-rows-2" : mosaicCount === 2 ? "lg:grid-cols-2" : "lg:grid-cols-1";

  return (
    <div className="relative">
      {/* One set of photos: a swipeable full-bleed strip on phones, a mosaic of
          the first five on wide screens. One element per photo, so the lead
          photo is downloaded once whatever the screen. */}
      <div
        className={cn(
          "no-scrollbar -mx-4 flex snap-x snap-mandatory overflow-x-auto sm:-mx-6",
          "lg:mx-0 lg:grid lg:h-[30rem] lg:snap-none lg:gap-2 lg:overflow-hidden lg:rounded-xl xl:h-[34rem]",
          layout,
        )}
        onScroll={(event) => {
          const element = event.currentTarget;
          setVisible(Math.round(element.scrollLeft / element.clientWidth));
        }}
      >
        {images.map((slide, position) => (
          <button
            key={`${slide.src}-${position}`}
            type="button"
            onClick={() => show(position)}
            aria-label={`Зураг ${position + 1}: ${slide.alt}`}
            className={cn(
              "group relative aspect-[4/3] w-full shrink-0 snap-center overflow-hidden bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold sm:aspect-[16/9] lg:aspect-auto lg:w-auto",
              position === 0 && mosaicCount >= 3 && "lg:col-span-2 lg:row-span-2",
              position >= mosaicCount && "lg:hidden",
            )}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={position === 0}
              sizes={position === 0 ? "(max-width: 1024px) 100vw, 820px" : "(max-width: 1024px) 100vw, 25vw"}
              quality={75}
              className="photo-zoom object-cover"
            />
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-0 rounded-full bg-black/55 px-3 py-1 text-[12px] font-semibold tabular-nums text-white backdrop-blur lg:hidden">
        {Math.min(visible + 1, images.length)} / {images.length}
      </div>

      <div className="absolute bottom-3 right-3 flex gap-2 sm:bottom-4 sm:right-4">
        {firstVideo >= 0 && (
          <button type="button" onClick={() => show(firstVideo)} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-[13px] font-semibold text-navy-night shadow-sm backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> Бичлэг
          </button>
        )}
        {slides.length > 1 && (
          <button type="button" onClick={() => show(0)} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-[13px] font-semibold text-navy-night shadow-sm backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
            <Grid2X2 className="h-4 w-4" aria-hidden="true" /> Бүх зураг ({images.length})
          </button>
        )}
      </div>

      <Lightbox slides={slides} index={index} onIndex={setIndex} open={open} onOpenChange={setOpen} />
    </div>
  );
}
