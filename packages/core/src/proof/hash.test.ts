import { describe, expect, it } from "vitest";
import {
  buildProofPayload,
  extractMemoFromLogs,
  hashReply,
  memoFromInstructionData,
  parseProofPayload,
  verifyTextMatchesPayload,
} from "./hash.js";
import { createMockProofPublisher } from "./mock.js";
import { verifyPostedText } from "./verify.js";
import { MemoryStore } from "../store/memory.js";

describe("proof hash and verify", () => {
  const signedAt = new Date("2026-09-29T15:04:05.000Z");
  const text = "$DANGER: HIGH risk.\n• Mint authority is still on.\nNot financial advice.";

  it("hashes the exact utf-8 text and leaves the timestamp outside the hash", () => {
    const first = buildProofPayload(text, signedAt);
    const later = buildProofPayload(text, new Date("2026-10-01T00:00:00.000Z"));
    expect(first.hash).toBe(hashReply(text));
    expect(first.hash).toBe(later.hash);
    expect(first.payload).not.toBe(later.payload);
    expect(first.payload).toBe(`lens:v1|2026-09-29T15:04:05.000Z|${first.hash}`);
    expect(hashReply(`${text} `)).not.toBe(first.hash);
  });

  it("verifies the original text and rejects an edit", () => {
    const proof = buildProofPayload(text, signedAt);
    expect(verifyTextMatchesPayload(text, proof.payload).ok).toBe(true);
    const edited = verifyTextMatchesPayload(text.replace("HIGH", "LOW"), proof.payload);
    expect(edited.ok).toBe(false);
    expect(edited.reason).toMatch(/does not match/);
  });

  it("rejects a memo that is not a Lens proof", () => {
    const result = verifyTextMatchesPayload(text, "hello world");
    expect(result.ok).toBe(false);
    expect(parseProofPayload("lens:v1|not-a-date|abcd")).toBeNull();
  });

  it("reads memo text from logs and instruction bytes", () => {
    const proof = buildProofPayload(text, signedAt);
    expect(extractMemoFromLogs([`Program log: Memo (len ${proof.payload.length}): "${proof.payload}"`])).toBe(
      proof.payload,
    );
    expect(memoFromInstructionData(Buffer.from(proof.payload, "utf8"))).toBe(proof.payload);
    expect(memoFromInstructionData(Buffer.from("nope", "utf8"))).toBeNull();
  });

  it("round-trips a mock chain memo and fails a tampered reply", async () => {
    const store = new MemoryStore();
    const proofs = createMockProofPublisher(store);
    const proof = buildProofPayload(text, signedAt);
    const published = await proofs.publish(proof.payload);
    expect(published.signature.startsWith("mock_")).toBe(true);
    const ok = await verifyPostedText(proofs, text, published.signature);
    expect(ok.ok).toBe(true);
    expect(ok.cluster).toBe("mock");
    const tampered = await verifyPostedText(proofs, `${text}\nextra`, published.signature);
    expect(tampered.ok).toBe(false);
    const missing = await verifyPostedText(proofs, text, "mock_missing");
    expect(missing.ok).toBe(false);
  });
});
