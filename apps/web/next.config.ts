import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second build or dev server can use its own folder (NEXT_DIST_DIR=.next-build) so it does not overwrite
  // the files a running `npm run dev` is serving.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@lens/core", "@lens/db"],
  serverExternalPackages: ["@prisma/client", "prisma", "@solana/web3.js", "bs58", "twitter-api-v2"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
