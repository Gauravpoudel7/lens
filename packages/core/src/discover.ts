import { PublicKey } from "@solana/web3.js";
import { log } from "./ids.js";
import { withRetry } from "./net/retry.js";

export interface TokenCandidate {
  mint: string;
  symbol: string | null;
}

export function isSolanaAddress(value: string): boolean {
  return isMint(value);
}

export function parseDexCandidateFeed(body: unknown): TokenCandidate[] {
  const rows = Array.isArray(body) ? body : [];
  const found: TokenCandidate[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as { chainId?: string; tokenAddress?: string; symbol?: string };
    if (record.chainId && record.chainId !== "solana") continue;
    const mint = record.tokenAddress?.trim();
    if (!mint || seen.has(mint) || !isMint(mint)) continue;
    seen.add(mint);
    found.push({ mint, symbol: record.symbol?.trim() || null });
  }
  return found;
}

export async function listDexCandidates(): Promise<TokenCandidate[]> {
  const urls = [
    "https://api.dexscreener.com/token-profiles/latest/v1",
    "https://api.dexscreener.com/token-boosts/latest/v1",
  ];
  const merged: TokenCandidate[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    try {
      const body = await withRetry(
        "dexscreener candidates",
        async () => {
          const response = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { accept: "application/json" } });
          if (!response.ok) throw new Error(`HTTP ${response.status} for dexscreener candidates`);
          return response.json();
        },
        { attempts: 3, baseMs: 500 },
      );
      for (const candidate of parseDexCandidateFeed(body)) {
        if (seen.has(candidate.mint)) continue;
        seen.add(candidate.mint);
        merged.push(candidate);
      }
    } catch (err) {
      log("candidate feed failed", err instanceof Error ? err.message : err);
    }
  }
  return merged.slice(0, 25);
}

function isMint(value: string): boolean {
  try {
    const key = new PublicKey(value);
    return key.toBase58() === value;
  } catch {
    return false;
  }
}
