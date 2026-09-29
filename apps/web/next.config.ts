import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
