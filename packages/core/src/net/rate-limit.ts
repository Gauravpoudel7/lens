/**
 * Client address for rate limits behind Railway's public HTTP edge.
 *
 * Railway's edge replaces a caller-supplied `X-Real-IP`. The value that
 * reaches the app is the address the edge observed (or the Cloudflare client
 * IP when that path sets it), so a forged header on the public site does not
 * stick. `X-Forwarded-For` is not used: its first hop is whatever a client
 * sent when a proxy appends, and Railway does not promise a fixed hop count.
 *
 * Private `*.railway.internal` traffic skips that edge and can set the header.
 * This key is for the public site. With no `X-Real-IP` (local `npm run dev`),
 * every caller shares the bucket `local`.
 */
export function trustedClientIp(headers: { get(name: string): string | null }): string {
  const real = headers.get("x-real-ip")?.trim() ?? "";
  if (!real || real.length > 80) return "local";
  return real;
}

export function createRateLimiter(maxKeys = 5_000) {
  const hits = new Map<string, { count: number; reset: number }>();
  return function allow(key: string, limit: number, windowMs = 60 * 60 * 1000, now = Date.now()): boolean {
    const current = hits.get(key);
    if (current && current.reset >= now) {
      hits.delete(key);
      if (current.count >= limit) {
        hits.set(key, current);
        return false;
      }
      current.count += 1;
      hits.set(key, current);
      return true;
    }
    while (hits.size >= maxKeys) {
      const oldest = hits.keys().next().value;
      if (oldest === undefined) break;
      hits.delete(oldest);
    }
    hits.set(key, { count: 1, reset: now + windowMs });
    return true;
  };
}
