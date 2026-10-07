import type { TokenDataProvider } from "./providers/types.js";
import { bareTickerNotice, verifiedMatchNotice } from "./tickers.js";

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

export type TokenResolution =
  | {
      status: "token";
      mint: string;
      symbol: string | null;
      name: string | null;
      via: "mint" | "symbol";
    }
  | {
      status: "notice";
      symbol: string;
      name: string;
      text: string;
    };

export async function resolveToken(
  text: string,
  provider: TokenDataProvider,
): Promise<TokenResolution | null> {
  const { mints, symbols } = extractTokenCandidates(text);
  if (mints[0]) {
    return { status: "token", mint: mints[0], symbol: symbols[0] ?? null, name: null, via: "mint" };
  }
  const symbol = symbols[0];
  if (!symbol) return null;
  const special = bareTickerNotice(symbol);
  if (special) return { status: "notice", symbol, name: noticeName(symbol), text: special };
  const match = await provider.resolveBySymbol(symbol);
  if (match.status === "unique") {
    return {
      status: "token",
      mint: match.token.mint,
      symbol: match.token.symbol,
      name: match.token.name,
      via: "symbol",
    };
  }
  const textNotice = verifiedMatchNotice(symbol, match);
  if (!textNotice) return null;
  return { status: "notice", symbol, name: "Needs a contract address", text: textNotice };
}

function noticeName(symbol: string): string {
  if (symbol === "SOL") return "Native Solana asset";
  if (symbol === "USDC" || symbol === "USDT") return "Stablecoin";
  if (symbol === "WBTC" || symbol === "WETH" || symbol === "WBNB") return "Wrapped major";
  return "Not a Solana token";
}
