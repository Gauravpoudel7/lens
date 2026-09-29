import { createHash } from "node:crypto";

export const MEMO_PREFIX = "lens:v1";
export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

export interface ProofPayload {
  hash: string;
  payload: string;
  signedAt: string;
}

export function hashReply(text: string): string {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

export function buildProofPayload(text: string, signedAt: Date): ProofPayload {
  const signedAtIso = signedAt.toISOString();
  const hash = hashReply(text);
  return {
    hash,
    signedAt: signedAtIso,
    payload: `${MEMO_PREFIX}|${signedAtIso}|${hash}`,
  };
}

export function parseProofPayload(
  payload: string,
): { version: "v1"; signedAt: string; hash: string } | null {
  const match = /^lens:v1\|([^|]+)\|([0-9a-f]{64})$/.exec(payload.trim());
  if (!match?.[1] || !match[2]) return null;
  if (Number.isNaN(Date.parse(match[1]))) return null;
  return { version: "v1", signedAt: match[1], hash: match[2] };
}

export function verifyTextMatchesPayload(
  text: string,
  payload: string,
): { ok: boolean; reason: string; hash: string; signedAt?: string } {
  const hash = hashReply(text);
  const parsed = parseProofPayload(payload);
  if (!parsed) {
    return { ok: false, reason: "Memo is not a Lens proof.", hash };
  }
  if (parsed.hash !== hash) {
    return {
      ok: false,
      reason: "Text does not match the stored hash.",
      hash,
      signedAt: parsed.signedAt,
    };
  }
  return {
    ok: true,
    reason: "Text matches the stored hash.",
    hash,
    signedAt: parsed.signedAt,
  };
}

export function extractMemoFromLogs(logs: string[]): string | null {
  for (const line of logs) {
    const match = /Memo \(len \d+\): "([^"]+)"/.exec(line);
    if (match?.[1]?.startsWith(`${MEMO_PREFIX}|`)) return match[1];
  }
  return null;
}

export function memoFromInstructionData(data: Uint8Array): string | null {
  const text = Buffer.from(data).toString("utf8").trim();
  if (!text.startsWith(`${MEMO_PREFIX}|`)) return null;
  return text;
}

export function explorerTxUrl(signature: string, cluster: string): string | null {
  if (!signature || signature.startsWith("mock_") || cluster === "mock") return null;
  const base = `https://explorer.solana.com/tx/${signature}`;
  if (cluster === "devnet") return `${base}?cluster=devnet`;
  if (cluster === "testnet") return `${base}?cluster=testnet`;
  return base;
}

export function xStatusUrl(id: string | null | undefined): string | null {
  if (!id || !/^\d+$/.test(id)) return null;
  return `https://x.com/i/status/${id}`;
}
