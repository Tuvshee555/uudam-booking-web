"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAllowedImageHost } from "@/lib/imageHosts";
import { useCloudinaryUpload } from "./useCloudinaryUpload";

/** A list of image or video URLs — extra trip photos, or extra clips. */
export default function MultiImageField({
  label,
  values,
  onChange,
  resourceType = "image",
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  resourceType?: "image" | "video";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const { upload, uploading } = useCloudinaryUpload();

  function addUrl() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (resourceType === "image" && !isAllowedImageHost(trimmed)) {
      toast.error('Энэ домэйноос зураг харагдахгүй. "Байршуулах" товчоор оруулна уу.');
      return;
    }
    onChange([...values, trimmed]);
    setDraft("");
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    try {
      const uploaded = await Promise.all(
        Array.from(files).map((file) => upload(file, resourceType)),
      );
      onChange([...values, ...uploaded]);
    } catch {
      toast.error("Байршуулахад алдаа гарлаа");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <Label>{label}</Label>

      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="https://…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
        />
        <button
          type="button"
          onClick={addUrl}
          className="shrink-0 rounded-md border border-input px-3 text-sm font-medium hover:bg-secondary"
        >
          Нэмэх
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={resourceType === "video" ? "video/*" : "image/*"}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((value, index) => (
            <div key={`${value}-${index}`} className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
              {resourceType === "image" ? (
                isAllowedImageHost(value) ? (
                  <Image src={value} alt="" fill sizes="128px" className="object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={value} alt="" className="h-full w-full object-cover" />
                )
              ) : (
                <video src={value} className="h-full w-full object-cover" muted />
              )}
              <button
                type="button"
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                aria-label="Устгах"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
