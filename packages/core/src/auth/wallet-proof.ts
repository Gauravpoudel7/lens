import { createPublicKey, randomBytes, verify as cryptoVerify } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { isActivePro, type UserRecord, type WatchRecord } from "../accounts.js";

export const WALLET_PROOF_TTL_MS = 10 * 60 * 1000;

const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function walletProofMessage(wallet: string, nonce: string, expiresAtMs: number): string {
  return `Lens account proof\nWallet: ${wallet}\nNonce: ${nonce}\nExpires: ${expiresAtMs}`;
}

export function verifyWalletProof(input: {
  wallet: string;
  nonce: string;
  expiresAtMs: number;
  signature: string;
  now?: number;
}): boolean {
  const now = input.now ?? Date.now();
  if (!Number.isFinite(input.expiresAtMs) || input.expiresAtMs <= now) return false;
  if (input.expiresAtMs - now > WALLET_PROOF_TTL_MS + 30_000) return false;
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(input.nonce)) return false;
  let publicKey: Uint8Array;
  let signature: Uint8Array;
  try {
    publicKey = new PublicKey(input.wallet).toBytes();
    signature = bs58.decode(input.signature);
  } catch {
    return false;
  }
  if (signature.length !== 64) return false;
  const message = new TextEncoder().encode(walletProofMessage(input.wallet, input.nonce, input.expiresAtMs));
  try {
    const key = createPublicKey({
      key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKey)]),
      format: "der",
      type: "spki",
    });
    return cryptoVerify(null, message, key, signature);
  } catch {
    return false;
  }
}

export interface IssuedNonce {
  nonce: string;
  expiresAt: number;
  message: string;
}

export interface NonceStore {
  issue(wallet: string, now?: number): IssuedNonce;
  matches(nonce: string, wallet: string, expiresAt: number, now?: number): boolean;
  /** Forgets the nonce so the same signature cannot be used again. */
  consume(nonce: string): void;
}

export function createNonceStore(maxKeys = 5_000): NonceStore {
  const issued = new Map<string, { wallet: string; expiresAt: number }>();
  return {
    issue(wallet, now = Date.now()) {
      while (issued.size >= maxKeys) {
        const oldest = issued.keys().next().value;
        if (oldest === undefined) break;
        issued.delete(oldest);
      }
      const nonce = randomBytes(16).toString("hex");
      const expiresAt = now + WALLET_PROOF_TTL_MS;
      issued.set(nonce, { wallet, expiresAt });
      return { nonce, expiresAt, message: walletProofMessage(wallet, nonce, expiresAt) };
    },
    matches(nonce, wallet, expiresAt, now = Date.now()) {
      const row = issued.get(nonce);
      if (!row || row.wallet !== wallet || row.expiresAt !== expiresAt) return false;
      if (row.expiresAt <= now) return false;
      return true;
    },
    consume(nonce) {
      issued.delete(nonce);
    },
  };
}

export function watchChangeAllowed(input: {
  unlocked: boolean;
  activePro: boolean;
}): { ok: true } | { ok: false; status: 401 | 403; error: string } {
  if (!input.unlocked) {
    return { ok: false, status: 401, error: "Sign in with the Pro wallet first." };
  }
  if (!input.activePro) {
    return { ok: false, status: 403, error: "Watchlist alerts are part of Pro." };
  }
  return { ok: true };
}

export function redactAccount(input: {
  user: UserRecord | null;
  watches: WatchRecord[];
  queriedHandle: string;
  unlocked: boolean;
  now?: Date;
}): {
  user: Pick<UserRecord, "xHandle" | "wallet" | "xUserId" | "proUntil" | "xLinkedAt"> | null;
  watches: WatchRecord[];
  tier: "free" | "pro";
  active: boolean;
  restricted: boolean;
  public: { pro: boolean; handle: string | null } | null;
} {
  if (!input.user) {
    return { user: null, watches: [], tier: "free", active: false, restricted: true, public: null };
  }
  const active = isActivePro(input.user, input.now);
  const tier = active ? "pro" : "free";
  if (!input.unlocked) {
    return {
      user: null,
      watches: [],
      tier,
      active,
      restricted: true,
      public: {
        pro: active,
        handle: input.queriedHandle.trim() ? input.user.xHandle : null,
      },
    };
  }
  return {
    user: {
      xHandle: input.user.xHandle,
      wallet: input.user.wallet,
      xUserId: input.user.xUserId,
      proUntil: input.user.proUntil,
      xLinkedAt: input.user.xLinkedAt,
    },
    watches: input.watches,
    tier,
    active,
    restricted: false,
    public: null,
  };
}
