"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { Film, ImageIcon, Link2, Loader2, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractUrl, mediaKind, type MediaItem } from "@/lib/media";
import { uploadErrorMessage, useCloudinaryUpload } from "./useCloudinaryUpload";

const KIND_LABEL = {
  image: "Зураг",
  video: "Бичлэг",
  youtube: "YouTube бичлэг",
  link: "Холбоос",
} as const;

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
    <div className="rounded-xl border border-border bg-secondary/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={item.url}
          onChange={(e) => onChange({ ...item, url: e.target.value })}
          placeholder="Холбоос буулгах (YouTube, сайт, зураг) — эсвэл баруун талаас байршуулна"
          className="min-w-[14rem] flex-1"
        />
        <button
          type="button"
          onClick={() => imageInput.current?.click()}
          disabled={uploading}
          className="flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Зураг
        </button>
        <button
          type="button"
          onClick={() => videoInput.current?.click()}
          disabled={uploading}
          className="flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          <Film className="h-3.5 w-3.5" />
          Бичлэг
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Устгах"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], "image")} />
        <input ref={videoInput} type="file" accept="video/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], "video")} />
      </div>

      <Input
        value={item.caption}
        onChange={(e) => onChange({ ...item, caption: e.target.value })}
        placeholder="Тайлбар (заавал биш) — ж.нь: Буудлын усан бассейн"
        className="mt-2"
      />

      <div className="mt-2 flex items-center gap-2 text-xs">
        {uploading ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Байршуулж байна… (том бичлэг хэдэн минут болж магадгүй)
          </span>
        ) : unreadable ? (
          <span className="text-destructive">Холбоос олдсонгүй — https://-ээр эхэлсэн холбоос оруулна уу.</span>
        ) : kind && url ? (
          <>
            {kind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="h-12 w-16 rounded border border-border object-cover" />
            )}
            {kind === "video" && (
              <video src={url} muted preload="metadata" className="h-12 w-20 rounded border border-border bg-black object-cover" />
            )}
            {kind === "link" && <Link2 className="h-4 w-4 text-muted-foreground" />}
            <span className="font-medium text-muted-foreground">{KIND_LABEL[kind]}</span>
          </>
        ) : null}
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
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
      >
        <Plus className="h-4 w-4" />
        Нэмэх
      </button>
    </div>
  );
}
