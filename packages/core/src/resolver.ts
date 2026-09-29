import type { TokenDataProvider } from "./providers/types.js";

const BASE58_CHAR = "[1-9A-HJ-NP-Za-km-z]";
const MINT_RE = new RegExp(
  `(?<!${BASE58_CHAR})${BASE58_CHAR}{32,44}(?!${BASE58_CHAR})`,
  "g",
);
const TICKER_RE = /\$([A-Za-z][A-Za-z0-9]{1,12})\b/g;

const IGNORED_MINTS = new Set([
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
]);

export interface TokenCandidates {
  mints: string[];
  symbols: string[];
}

export function extractTokenCandidates(text: string): TokenCandidates {
  const mints: string[] = [];
  const symbols: string[] = [];
  for (const match of text.matchAll(MINT_RE)) {
    const mint = match[0];
    if (!mint || IGNORED_MINTS.has(mint) || mints.includes(mint)) continue;
    mints.push(mint);
  }
  for (const match of text.matchAll(TICKER_RE)) {
    const symbol = match[1]?.toUpperCase();
    if (!symbol || symbols.includes(symbol)) continue;
    symbols.push(symbol);
  }
  return { mints, symbols };
}

export interface ResolvedToken {
  mint: string;
  symbol: string | null;
  name: string | null;
  via: "mint" | "symbol";
}

export async function resolveToken(
  text: string,
  provider: TokenDataProvider,
): Promise<ResolvedToken | null> {
  const { mints, symbols } = extractTokenCandidates(text);
  if (mints[0]) {
    return { mint: mints[0], symbol: symbols[0] ?? null, name: null, via: "mint" };
  }
  for (const symbol of symbols) {
    const found = await provider.resolveBySymbol(symbol);
    if (found) {
      return { mint: found.mint, symbol: found.symbol, name: found.name, via: "symbol" };
    }
  }
  return null;
}
