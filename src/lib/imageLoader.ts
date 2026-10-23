/**
 * next/image loader that resizes at the photo's own host instead of through
 * Vercel's /_next/image. The site's allowance for that optimizer ran out and
 * every photo it had not already cached came back 402 (blank hero, broken
 * category tiles). Cloudinary and Unsplash both resize by URL, so the browser
 * asks them for the right width directly.
 */
export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  if (src.startsWith("https://res.cloudinary.com/") && src.includes("/image/upload/")) {
    // c_limit never upscales; f_auto serves AVIF/WebP where the browser takes it.
    return src.replace("/image/upload/", `/image/upload/f_auto,q_${quality ?? "auto"},w_${width},c_limit/`);
  }
  if (src.startsWith("https://images.unsplash.com/")) {
    const url = new URL(src);
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", String(quality ?? 75));
    url.searchParams.set("auto", "format");
    return url.toString();
  }
  return src;
}
