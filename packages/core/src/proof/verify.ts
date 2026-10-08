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
  expectedSigner?: string | null,
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
  const localMemo = memo.cluster === "mock" || signature.startsWith("mock_");
  if (!localMemo) {
    if (!expectedSigner) {
      return {
        ok: false,
        reason: "Proof signer is not configured.",
        hash: verifyTextMatchesPayload(text, "").hash,
        cluster: memo.cluster,
        slotTime: memo.slotTime,
        signature,
      };
    }
    if (!memo.signers.includes(expectedSigner)) {
      return {
        ok: false,
        reason: "That memo was not signed by the Lens proof wallet.",
        hash: verifyTextMatchesPayload(text, "").hash,
        cluster: memo.cluster,
        slotTime: memo.slotTime,
        signature,
      };
    }
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
