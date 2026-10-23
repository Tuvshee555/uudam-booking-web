/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  images: {
    // Vercel's optimizer returns 402 once the deployment's image quota is
    // exhausted, which leaves otherwise healthy Cloudinary/Unsplash photos
    // broken. Photos are resized by their own host through this loader
    // instead of being proxied through /_next/image.
    loader: "custom",
    loaderFile: "./src/lib/imageLoader.ts",
    qualities: [75, 85, 90],
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
};

export default nextConfig;
