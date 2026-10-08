import { createHmac, timingSafeEqual } from "node:crypto";
import { isSolanaAddress } from "../discover.js";

export const SESSION_COOKIE = "lens_session";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function mac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/**
 * A wallet session token: `v1.<wallet>.<expiresAtMs>.<hmac>`. Issued only after the wallet signs a fresh nonce,
 * so the cookie proves "this browser signed with this wallet in the last 24 hours".
 */
export function signSession(wallet: string, secret: string, now = Date.now()): { token: string; expiresAt: number } {
  const expiresAt = now + SESSION_TTL_MS;
  const body = `v1.${wallet}.${expiresAt}`;
  return { token: `${body}.${mac(body, secret)}`, expiresAt };
}

/** The wallet the token was issued to, or null when it is malformed, tampered with, or expired. */
export function verifySession(token: string | null | undefined, secret: string, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [, wallet, expires, signature] = parts as [string, string, string, string];
  const expiresAt = Number(expires);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt - now > SESSION_TTL_MS) return null;
  if (!isSolanaAddress(wallet)) return null;
  const expected = Buffer.from(mac(`v1.${wallet}.${expires}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return wallet;
}
