import type { ProofPublisher } from "./solana.js";
import { verifyTextMatchesPayload } from "./hash.js";

export interface VerifyResult {
  ok: boolean;
  reason: string;
  hash: string;
  signedAt?: string;
  cluster: string | null;
  slotTime: string | null;
  signature: string;
}

export async function verifyPostedText(
  proofs: ProofPublisher,
  text: string,
  signature: string,
): Promise<VerifyResult> {
  const memo = await proofs.readMemo(signature);
  if (!memo.payload) {
    return {
      ok: false,
      reason: "No Lens memo was found for that signature.",
      hash: verifyTextMatchesPayload(text, "").hash,
      cluster: memo.cluster,
      slotTime: memo.slotTime,
      signature,
    };
  }
  const matched = verifyTextMatchesPayload(text, memo.payload);
  if (matched.ok && memo.slotTime && matched.signedAt) {
    const skew = Math.abs(Date.parse(memo.slotTime) - Date.parse(matched.signedAt));
    if (skew > 30 * 60 * 1000) {
      return {
        ok: false,
        reason: "The memo timestamp does not match the chain time.",
        hash: matched.hash,
        signedAt: matched.signedAt,
        cluster: memo.cluster,
        slotTime: memo.slotTime,
        signature,
      };
    }
  }
  return {
    ...matched,
    cluster: memo.cluster,
    slotTime: memo.slotTime,
    signature,
  };
}
