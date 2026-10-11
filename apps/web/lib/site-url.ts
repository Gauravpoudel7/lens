/** Absolute origin for link previews, the sitemap, and JSON-LD. */
export function siteUrl(): URL {
  const fallback = "http://localhost:3847";
  try {
    return new URL(process.env.PUBLIC_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || fallback);
  } catch {
    return new URL(fallback);
  }
}

export function siteOrigin(): string {
  return siteUrl().href.replace(/\/$/, "");
}
