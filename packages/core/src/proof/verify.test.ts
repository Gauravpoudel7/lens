import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { buildProofPayload } from "./hash.js";
import { extractSigners, type ProofPublisher } from "./solana.js";
import { verifyPostedText } from "./verify.js";

function publisher(signers: string[], cluster = "devnet"): ProofPublisher {
  return {
    async publish() {
      return { signature: "sig", cluster };
    },
    async readMemo() {
      const proof = buildProofPayload("HIGH risk.\nNot financial advice.", new Date("2026-10-01T00:00:00.000Z"));
      return { payload: proof.payload, cluster, slotTime: null, signers };
    },
  };
}

describe("proof signer", () => {
  const text = "HIGH risk.\nNot financial advice.";

  it("rejects a chain memo signed by someone else", async () => {
    const lens = Keypair.generate().publicKey.toBase58();
    const other = Keypair.generate().publicKey.toBase58();
    const result = await verifyPostedText(publisher([other]), text, "sig", lens);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/proof wallet/i);
  });

  it("accepts a chain memo signed by the configured proof wallet", async () => {
    const lens = Keypair.generate().publicKey.toBase58();
    const result = await verifyPostedText(publisher([lens]), text, "sig", lens);
    expect(result.ok).toBe(true);
  });

  it("fails closed when no proof signer is configured", async () => {
    const other = Keypair.generate().publicKey.toBase58();
    const result = await verifyPostedText(publisher([other]), text, "sig", null);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not configured/i);
  });

  it("still verifies local mock memos", async () => {
    const result = await verifyPostedText(publisher([], "mock"), text, "mock_abc", null);
    expect(result.ok).toBe(true);
  });

  it("reads the required signers from a transaction message", () => {
    const lens = Keypair.generate().publicKey;
    const other = Keypair.generate().publicKey;
    expect(
      extractSigners({
        transaction: {
          message: {
            header: { numRequiredSignatures: 1 },
            staticAccountKeys: [lens, other],
          },
        },
      }),
    ).toEqual([lens.toBase58()]);
  });
});
