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
    // The site itself never asks /_next/image for anything now. These
    // patterns only keep old optimizer links working: crawlers still request
    // a few an hour from before the loader. Vercel answers /_next/image before
    // any redirect, so they cannot be sent to the photo's host instead;
    // without the patterns they get a 400 (checked on a preview, 2026-11-01).
    loader: "custom",
    loaderFile: "./src/lib/imageLoader.ts",
    qualities: [70, 75, 85, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      // Answered by Vercel's routing, before the proxy function would run.
      { source: "/", destination: "/mn", permanent: true },
      // /en and /ko were copies of /mn (RETIRED_LOCALES in src/lib/locales.ts).
      // Anything still pointing at them — an old search result, a shared
      // link — lands on the real page.
      { source: "/:locale(en|ko)/:path*", destination: "/mn/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
