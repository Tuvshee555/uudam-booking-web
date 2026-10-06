"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { ImageIcon, Link2, Loader2, Play, Plus, Trash2, Upload } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractUrl, mediaKind, youtubeEmbed, type MediaItem, type MediaKind } from "@/lib/media";
import { uploadErrorMessage, useCloudinaryUpload } from "./useCloudinaryUpload";

const KIND_LABEL = {
  image: "Зураг",
  video: "Бичлэг",
  youtube: "YouTube бичлэг",
  link: "Холбоос",
} as const;

/** A large visual preview of whatever the row's URL currently resolves to — the
 * point is that staff SEE the photo/video they attached, not a filename. */
function Preview({ url, kind }: { url: string; kind: MediaKind | null }) {
  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-full w-full object-cover" />;
  }
  if (kind === "video") {
    // #t=0.1 forces the browser to seek and paint that frame as a poster —
    // without it a plain <video preload="metadata"> shows a black box until
    // played, which is exactly the "just a filename, no preview" complaint.
    return <video src={`${url}#t=0.1`} muted preload="metadata" className="h-full w-full object-cover" />;
  }
  const embed = kind === "youtube" ? youtubeEmbed(url) : null;
  if (kind === "youtube" && embed) {
    // A thumbnail is enough here — an embedded iframe per row is heavy and
    // autoplays sound in some browsers on load.
    const videoId = embed.split("/embed/")[1];
    return (
      <div className="relative h-full w-full bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-80" />
        <span className="absolute inset-0 flex items-center justify-center">
          <Play className="h-8 w-8 fill-white text-white drop-shadow" />
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-secondary text-muted-foreground">
      <Link2 className="h-6 w-6" />
      <span className="max-w-[90%] truncate text-[11px]">{url.replace(/^https?:\/\//, "")}</span>
    </div>
  );
}

function MediaRow({
  item,
  onChange,
  onRemove,
}: {
  item: MediaItem;
  onChange: (next: MediaItem) => void;
  onRemove: () => void;
}) {
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useCloudinaryUpload();

  const url = extractUrl(item.url);
  const kind = url ? mediaKind(url) : null;
  const unreadable = item.url.trim().length > 0 && !url;
  const empty = !item.url.trim();

  async function handleFile(file: File | undefined, resourceType: "image" | "video") {
    if (!file) return;
    try {
      onChange({ ...item, url: await upload(file, resourceType) });
    } catch (err) {
      toast.error(uploadErrorMessage(err));
    } finally {
      if (imageInput.current) imageInput.current.value = "";
      if (videoInput.current) videoInput.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border py-3 sm:flex-row">
      {/* Preview tile — this is the whole point: SEE what's attached. */}
      <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
        {uploading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : unreadable ? (
          <div className="flex h-full w-full items-center justify-center p-1 text-center text-[11px] text-destructive">
            Холбоос олдсонгүй
          </div>
        ) : empty ? (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
        ) : (
          <Preview url={url!} kind={kind} />
        )}
        {kind && url && !uploading && (
          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {KIND_LABEL[kind]}
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
          aria-label="Устгах"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Input
            value={item.url}
            onChange={(e) => onChange({ ...item, url: e.target.value })}
            placeholder="Холбоос буулгах (YouTube, сайт, зураг)"
            aria-label="Медиа холбоос"
            className={`min-w-0 basis-full sm:flex-1 sm:basis-0 ${unreadable ? "border-destructive" : ""}`}
          />
          <button
            type="button"
            onClick={() => imageInput.current?.click()}
            disabled={uploading}
            title="Зураг байршуулах"
            aria-label="Зураг байршуулах"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            Зураг
          </button>
          <button
            type="button"
            onClick={() => videoInput.current?.click()}
            disabled={uploading}
            title="Бичлэг байршуулах"
            aria-label="Бичлэг байршуулах"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            Бичлэг
          </button>
          <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], "image")} />
          <input ref={videoInput} type="file" accept="video/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], "video")} />
        </div>

        <Input
          aria-label="Медиа тайлбар"
          value={item.caption}
          onChange={(e) => onChange({ ...item, caption: e.target.value })}
          placeholder="Тайлбар"
        />

        {uploading && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Байршуулж байна… (том бичлэг хэдэн минут болж магадгүй)
          </p>
        )}
        {unreadable && (
          <p className="text-xs text-destructive">Холбоос олдсонгүй — https://-ээр эхэлсэн холбоос оруулна уу.</p>
        )}
      </div>
    </div>
  );
}

/** An editable list of photos / videos / links — hotel media, travelers' media. */
export default function MediaListEditor({
  label,
  hint,
  items,
  onChange,
}: {
  label: string;
  hint?: string;
  items: MediaItem[];
  onChange: (next: MediaItem[]) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}

      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <MediaRow
            key={index}
            item={item}
            onChange={(next) => onChange(items.map((current, i) => (i === index ? next : current)))}
            onRemove={() => onChange(items.filter((_, i) => i !== index))}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...items, { url: "", caption: "" }])}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary"
      >
        <Plus className="h-4 w-4" />
        Нэмэх
      </button>
    </div>
  );
}
