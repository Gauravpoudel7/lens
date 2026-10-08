import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE, log, signSession, verifySession, verifyWalletProof, type LensConfig } from "@lens/core";
import { getRuntime } from "./runtime";
import { walletNonces } from "./wallet-nonce";

export interface WalletProofFields {
  wallet: string;
  nonce: string;
  expiresAtMs: number;
  signature: string;
}

export function readWalletProof(
  source: { wallet?: unknown; nonce?: unknown; expiresAt?: unknown; signature?: unknown } | null,
): WalletProofFields | null {
  if (!source) return null;
  const { wallet, nonce, signature } = source;
  if (typeof wallet !== "string" || typeof nonce !== "string" || typeof signature !== "string") return null;
  const expiresAtMs = Number(source.expiresAt);
  if (!wallet.trim() || !nonce.trim() || !signature.trim() || !Number.isFinite(expiresAtMs)) return null;
  return { wallet: wallet.trim(), nonce: nonce.trim(), expiresAtMs, signature: signature.trim() };
}

/** A fresh nonce, signed by the wallet. The nonce is used up, so the same signature cannot start a second session. */
export function proofIsValid(proof: WalletProofFields): boolean {
  if (!walletNonces.matches(proof.nonce, proof.wallet, proof.expiresAtMs)) return false;
  if (!verifyWalletProof(proof)) return false;
  walletNonces.consume(proof.nonce);
  return true;
}

const globalForSecret = globalThis as unknown as { lensSessionSecret?: string };

function sessionSecret(config: Pick<LensConfig, "sessionSecret">): string {
  if (config.sessionSecret) return config.sessionSecret;
  if (!globalForSecret.lensSessionSecret) {
    globalForSecret.lensSessionSecret = randomBytes(32).toString("hex");
    log("LENS_SESSION_SECRET is not set", { detail: "Using a random key. Sessions end when the app restarts." });
  }
  return globalForSecret.lensSessionSecret;
}

/** The wallet this browser signed in with, or null. */
export async function sessionWallet(): Promise<string | null> {
  const rt = await getRuntime();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token, sessionSecret(rt.config));
}

export async function startSession(wallet: string): Promise<void> {
  const rt = await getRuntime();
  const { token, expiresAt } = signSession(wallet, sessionSecret(rt.config));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: rt.config.publicBaseUrl.startsWith("https://"),
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Cookie-authenticated writes must come from this site. Browsers always send Origin on POST and DELETE, so a
 * missing Origin means a non-browser client, which has no victim cookie to ride on.
 */
export function sameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}
