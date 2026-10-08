import { createRateLimiter, trustedClientIp } from "@lens/core";

const allow = createRateLimiter();

export function allowRequest(key: string, limit: number, windowMs = 60 * 60 * 1000): boolean {
  return allow(key, limit, windowMs);
}

/** `bucket` keeps check, verify, and Blink limits from spending each other's quota. */
export function clientKey(request: Request, bucket = "check"): string {
  return `${bucket}:${trustedClientIp(request.headers)}`;
}
