/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  images: {
    // Vercel's optimizer returns 402 once the deployment's image quota is
    // exhausted, which leaves otherwise healthy Cloudinary/Unsplash photos
    // broken. Photos are resized by their own host through this loader
    // instead of being proxied through /_next/image.
    //
    // Nothing on the site asks /_next/image for anything any more, so no
    // remote host is allowed through it either (remotePatterns used to allow
    // Unsplash and Cloudinary): crawlers still request old optimizer links,
    // and each one was an optimizer cache read or a new transformation on the
    // shared quota. Those links are redirected to the photo's host below.
    loader: "custom",
    loaderFile: "./src/lib/imageLoader.ts",
    qualities: [70, 75, 85, 90],
  },
  async redirects() {
    return [
      // Answered by Vercel's routing, before the proxy function would run.
      { source: "/", destination: "/mn", permanent: true },
      // /en and /ko were copies of /mn (RETIRED_LOCALES in src/lib/locales.ts).
      // Anything still pointing at them — an old search result, a shared
      // link — lands on the real page.
      { source: "/:locale(en|ko)/:path*", destination: "/mn/:path*", permanent: true },
      // An old optimizer link: the same photo at its own host, resized there
      // (src/app/api/legacy-image).
      {
        source: "/_next/image",
        has: [{ type: "query", key: "url" }],
        destination: "/api/legacy-image",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
