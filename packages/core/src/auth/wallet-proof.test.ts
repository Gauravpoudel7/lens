import { createPrivateKey, sign } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { describe, expect, it } from "vitest";
import { createNonceStore, redactAccount, verifyWalletProof, watchChangeAllowed, walletProofMessage } from "./wallet-proof.js";
import type { UserRecord } from "../accounts.js";

function signMessage(secret: Uint8Array, message: string): string {
  const key = createPrivateKey({
    key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), secret.subarray(0, 32)]),
    format: "der",
    type: "pkcs8",
  });
  return bs58.encode(sign(null, Buffer.from(message), key));
}

function user(partial: Partial<UserRecord> = {}): UserRecord {
  return {
    id: "u1",
    xUserId: "123",
    xHandle: "holder",
    wallet: "wallet",
    tier: "pro",
    proUntil: "2099-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("wallet proof", () => {
  it("accepts a signature from the wallet and rejects a different one", () => {
    const owner = Keypair.generate();
    const wallet = owner.publicKey.toBase58();
    const expiresAtMs = Date.now() + 60_000;
    const nonce = "abcdef0123456789";
    const signature = signMessage(owner.secretKey, walletProofMessage(wallet, nonce, expiresAtMs));
    expect(verifyWalletProof({ wallet, nonce, expiresAtMs, signature })).toBe(true);
    expect(verifyWalletProof({ wallet, nonce, expiresAtMs: expiresAtMs + 1, signature })).toBe(false);
    expect(verifyWalletProof({ wallet: Keypair.generate().publicKey.toBase58(), nonce, expiresAtMs, signature })).toBe(
      false,
    );
  });

  it("only matches a nonce this process issued", () => {
    const store = createNonceStore();
    const issued = store.issue("Wallet111", 1_000);
    expect(store.matches(issued.nonce, "Wallet111", issued.expiresAt, 1_000)).toBe(true);
    expect(store.matches(issued.nonce, "Other", issued.expiresAt, 1_000)).toBe(false);
    expect(store.matches("not-issued-nonce", "Wallet111", issued.expiresAt, 1_000)).toBe(false);
  });

  it("hides the wallet and watchlist until the proof unlocks them", () => {
    const account = user();
    const hidden = redactAccount({
      user: account,
      watches: [{ id: "w", userId: "u1", mint: "mint", symbol: "M", createdAt: "2026-01-01T00:00:00.000Z" }],
      queriedHandle: "holder",
      unlocked: false,
    });
    expect(hidden.user).toBeNull();
    expect(hidden.watches).toEqual([]);
    expect(hidden.public).toEqual({ pro: true, handle: "holder" });
    const shown = redactAccount({ user: account, watches: [], queriedHandle: "", unlocked: true });
    expect(shown.user?.wallet).toBe("wallet");
    expect(shown.user?.xUserId).toBe("123");
  });

  it("requires an active Pro account and a wallet signature to change a watch", () => {
    expect(watchChangeAllowed({ unlocked: false, activePro: true }).ok).toBe(false);
    expect(watchChangeAllowed({ unlocked: true, activePro: false })).toMatchObject({ status: 403 });
    expect(watchChangeAllowed({ unlocked: true, activePro: true }).ok).toBe(true);
  });
});
