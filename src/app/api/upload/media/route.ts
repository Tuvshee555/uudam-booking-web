import { cloudinary } from "@/server/cloudinary";
import { requireAdmin } from "@/server/auth";
import { clientIp, handler, httpError, json, rateLimit } from "@/server/http";

export const runtime = "nodejs";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

/**
 * Vercel caps a function's request body at 4.5MB, so this route handles small
 * images only. Videos and large photos must go browser → Cloudinary directly
 * using /api/upload/signature; routing those through here would fail at the
 * platform edge before any of this code ran.
 */
const MAX_BYTES = 4 * 1024 * 1024;

export const POST = handler(async (req: Request) => {
  await requireAdmin(req);
  rateLimit(`upload:${clientIp(req)}`, { windowMs: 15 * 60 * 1000, max: 60 });

  const form = await req.formData().catch(() => null);
  if (!form) throw httpError(400, "Файл илгээгдсэнгүй");

  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (!files.length) throw httpError(400, "Файл илгээгдсэнгүй");
  if (files.length > 6) throw httpError(400, "Нэг удаад 6 хүртэл зураг");

  const urls: string[] = [];

  for (const file of files) {
    if (!ALLOWED_MIME.has(file.type)) {
      throw httpError(415, `Дэмжигдэхгүй файл: ${file.type || "тодорхойгүй"}`);
    }
    if (file.size > MAX_BYTES) {
      throw httpError(413, "Зураг 4MB-аас том байна. Шууд илгээх горимыг ашиглана уу.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploaded = await new Promise<string>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: "uudam/trips", resource_type: "image" }, (error, result) => {
          if (error || !result) return reject(error ?? new Error("Upload failed"));
          resolve(result.secure_url);
        })
        .end(buffer);
    });

    urls.push(uploaded);
  }

  return json({ urls });
});
