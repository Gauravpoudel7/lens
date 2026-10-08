import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only the dependency-free `@lens/core/defaults` and `@lens/core/thresholds` files are imported here.
  transpilePackages: ["@lens/core"],
};

export default nextConfig;
