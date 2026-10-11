import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteOrigin();
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/record`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/check`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/updates`, changeFrequency: "daily", priority: 0.5 },
    { url: `${base}/pro`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/verified`, changeFrequency: "daily", priority: 0.5 },
    { url: `${base}/account`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/verify`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
