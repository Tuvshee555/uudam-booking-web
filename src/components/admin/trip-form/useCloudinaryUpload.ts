"use client";

import { useState } from "react";
import { api } from "@/lib/api";

type Signature = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  uploadUrl: string;
};

/** A staff-readable reason for a failed upload, oversized files called out plainly. */
export function uploadErrorMessage(err: unknown): string {
  const detail = err instanceof Error ? err.message : "";
  if (/too large/i.test(detail)) {
    return "Файл хэт том байна. Бичлэгийг богиносгох, эсвэл YouTube-д байршуулаад холбоосыг нь оруулна уу.";
  }
  return detail ? `Байршуулахад алдаа гарлаа: ${detail}` : "Байршуулахад алдаа гарлаа";
}

/**
 * Uploads a file straight from the browser to Cloudinary using a short-lived
 * signature from our own API. Never routes the file bytes through our server
 * — trip videos routinely exceed the 4.5MB a Vercel function body allows.
 */
export function useCloudinaryUpload() {
  const [uploading, setUploading] = useState(false);

  async function upload(file: File, resourceType: "image" | "video" = "image"): Promise<string> {
    setUploading(true);
    try {
      const { data: sig } = await api.post<Signature>("/upload/signature", { resourceType });

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("signature", sig.signature);
      form.append("folder", sig.folder);

      const res = await fetch(sig.uploadUrl, { method: "POST", body: form });
      if (!res.ok) {
        // Cloudinary says exactly why ("File size too large. Got … Maximum is
        // …") — surface that instead of a bare "failed", which left staff
        // with an upload that silently never appeared.
        const detail = await res
          .json()
          .then((body: { error?: { message?: string } }) => body.error?.message)
          .catch(() => undefined);
        throw new Error(detail || `Cloudinary upload failed (${res.status})`);
      }

      const uploaded = (await res.json()) as { secure_url: string };
      return uploaded.secure_url;
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading };
}
