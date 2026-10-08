import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NEXT_DIST_DIR lets a build run next to `npm run dev:landing` without overwriting its files.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Only the dependency-free `@lens/core/defaults` and `@lens/core/thresholds` files are imported here.
  transpilePackages: ["@lens/core"],
};

export default nextConfig;
