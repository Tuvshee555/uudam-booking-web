"use client";

import { useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAllowedImageHost } from "@/lib/imageHosts";
import { useCloudinaryUpload } from "./useCloudinaryUpload";

/** One image or video URL — paste a link, or upload a file straight to Cloudinary. */
export default function ImageUploadField({
  label,
  value,
  onChange,
  resourceType = "image",
  required,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  resourceType?: "image" | "video";
  required?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useCloudinaryUpload();
  const badHost = resourceType === "image" && value.trim() && !isAllowedImageHost(value);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const url = await upload(file, resourceType);
      onChange(url);
    } catch {
      toast.error("Байршуулахад алдаа гарлаа");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>

      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className={badHost ? "border-destructive" : undefined}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Байршуулах
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={resourceType === "video" ? "video/*" : "image/*"}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {badHost && (
        <p className="mt-1.5 text-xs text-destructive">
          Энэ домэйноос зураг харагдахгүй. &quot;Байршуулах&quot; товчоор оруулна уу.
        </p>
      )}

      {value && resourceType === "image" && (
        <div className="relative mt-2 h-28 w-44 overflow-hidden rounded-lg border border-border bg-secondary">
          {badHost ? (
            // next/image throws for a host outside remotePatterns — a plain
            // <img> here is just an admin-side preview, never what customers see.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <Image src={value} alt="" fill sizes="176px" className="object-cover" />
          )}
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            aria-label="Устгах"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {value && resourceType === "video" && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <video src={value} className="h-16 w-28 rounded-lg border border-border object-cover" muted />
          <button type="button" onClick={() => onChange("")} className="hover:text-destructive">
            Устгах
          </button>
        </div>
      )}
    </div>
  );
}
