import { NextResponse } from "next/server";

import imageLoader from "@/lib/imageLoader";
import { isAllowedImageHost } from "@/lib/imageHosts";

/**
 * GET /api/legacy-image?url=…&w=…&q=… — where old /_next/image links land
 * (next.config.mjs redirects them here). Until 2026-10-23 the site's photos
 * went through Vercel's image optimizer, and crawlers and old shares still ask
 * for those links. Each is sent to the same photo at its own host, resized by
 * the loader the site uses now, so the link keeps working without touching
 * the optimizer's quota. Permanent, and cached by the CDN for a year, so each
 * old link costs one function call at most.
 */
export function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const src = params.get("url") ?? "";
  const width = Number.parseInt(params.get("w") ?? "", 10);
  const quality = Number.parseInt(params.get("q") ?? "", 10);

  let target: URL;
  if (src.startsWith("/")) {
    // A photo from this site's own /public: same origin only, never elsewhere.
    target = new URL(src, req.url);
    if (target.origin !== new URL(req.url).origin) return notFound();
  } else if (src.startsWith("https://") && isAllowedImageHost(src)) {
    target = new URL(
      imageLoader({
        src,
        width: width > 0 ? Math.min(width, 3840) : 1080,
        quality: quality > 0 ? Math.min(quality, 100) : undefined,
      }),
    );
  } else {
    return notFound();
  }

  const res = NextResponse.redirect(target, 308);
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=31536000");
  return res;
}

function notFound() {
  return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "public, s-maxage=86400" } });
}
