// Same memo shape as packages/core/src/proof/hash.ts (lens:v1|<ISO>|<sha256 hex>),
// computed in the browser so the landing page does not bundle @lens/core.
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function shortHash(hex: string) {
  return `${hex.slice(0, 4)}…${hex.slice(-4)}`;
}
