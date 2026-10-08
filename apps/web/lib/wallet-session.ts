import { verifyWalletProof, type UserRecord } from "@lens/core";
import { walletNonces } from "./wallet-nonce";

export interface WalletProofFields {
  wallet: string;
  nonce: string;
  expiresAtMs: number;
  signature: string;
}

export function readWalletProof(
  source: {
    wallet?: unknown;
    nonce?: unknown;
    expiresAt?: unknown;
    signature?: unknown;
    proofWallet?: unknown;
  } | null,
): WalletProofFields | null {
  if (!source) return null;
  const wallet = typeof source.wallet === "string" ? source.wallet : source.proofWallet;
  if (typeof wallet !== "string" || typeof source.nonce !== "string" || typeof source.signature !== "string") {
    return null;
  }
  const expiresAtMs = Number(source.expiresAt);
  if (!wallet.trim() || !source.nonce.trim() || !source.signature.trim() || !Number.isFinite(expiresAtMs)) {
    return null;
  }
  return {
    wallet: wallet.trim(),
    nonce: source.nonce.trim(),
    expiresAtMs,
    signature: source.signature.trim(),
  };
}

export function walletUnlocks(user: Pick<UserRecord, "wallet"> | null, proof: WalletProofFields | null): boolean {
  if (!user?.wallet || !proof || proof.wallet !== user.wallet) return false;
  if (!walletNonces.matches(proof.nonce, proof.wallet, proof.expiresAtMs)) return false;
  return verifyWalletProof(proof);
}
