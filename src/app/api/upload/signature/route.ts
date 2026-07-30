import { signUpload } from "@/server/cloudinary";
import { requireAdmin } from "@/server/auth";
import { clientIp, handler, httpError, json, rateLimit, readJson } from "@/server/http";

export const runtime = "nodejs";

/**
 * POST /api/upload/signature
 *
 * Hands the admin panel a short-lived Cloudinary signature so the browser can
 * upload straight to Cloudinary. This is the only workable path for trip
 * videos: they routinely exceed the 4.5MB request-body ceiling a Vercel
 * function has, so they can never transit our own API.
 */
export const POST = handler(async (req: Request) => {
  await requireAdmin(req);
  rateLimit(`sign:${clientIp(req)}`, { windowMs: 15 * 60 * 1000, max: 120 });

  const body = await readJson(req);
  const resourceType = body.resourceType === "video" ? "video" : "image";

  const folder = resourceType === "video" ? "uudam/trip-videos" : "uudam/trips";

  try {
    return json(signUpload(folder, resourceType));
  } catch (err) {
    console.error("Cloudinary signature failed:", err);
    throw httpError(500, "Cloudinary тохиргоо дутуу байна");
  }
});
