/**
 * Hosts whose photos the site's image loader resizes (src/lib/imageLoader.ts),
 * and the only hosts an old /_next/image link is redirected to
 * (api/legacy-image). A photo from anywhere else would be served full size,
 * unresized, on every page its trip appears on, so the admin form validates
 * against this list before ever saving the URL.
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
