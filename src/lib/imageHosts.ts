/**
 * Hosts `next/image` is actually allowed to optimize — must match
 * `remotePatterns` in next.config.mjs exactly. Pasting a photo URL from
 * anywhere else doesn't error loudly; it just serves a broken image on every
 * page that trip appears on, so the admin form validates against this list
 * before ever saving the URL.
 */
const ALLOWED_IMAGE_HOSTS = ["images.unsplash.com", "res.cloudinary.com"];

export function isAllowedImageHost(url: string): boolean {
  if (!url.trim()) return true; // empty is a separate required-field concern
  if (url.startsWith("/")) return true;
  try {
    return ALLOWED_IMAGE_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export { ALLOWED_IMAGE_HOSTS };
