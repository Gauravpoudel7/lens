import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@lens/core", "@lens/db"],
  serverExternalPackages: ["@prisma/client", "prisma", "@solana/web3.js", "bs58", "twitter-api-v2"],
};

export default nextConfig;
