import { USDC_MINT_MAINNET, USDT_MINT_MAINNET } from "./config.js";
import { normalizeTicker } from "./providers/parse.js";
import type { SymbolMatch } from "./providers/types.js";
import {
  ambiguousTickerReply,
  foreignTickerReply,
  nativeSolReply,
  stableTickerReply,
  unavailableTickerReply,
  wrappedMajorReply,
} from "./reply/policy.js";

/**
 * Bare $ticker policy.
 *
 * Jupiter's verified list is the only symbol lookup. DexScreener liquidity
 * is not used, because a pool can report a fake depth and outrank the real token.
 *
 * Some tickers are not scored even when that list has a mint:
 * - SOL is the native asset. Wrapped SOL would be judged like a meme coin.
 * - USDC and USDT are issuer stablecoins. Freeze authority stays on so the
 *   issuer can freeze accounts, and the risk engine would call that danger.
 *   The reply names the canonical mint and asks for a contract if they meant
 *   a different token.
 * - WBTC, WETH, and WBNB are wrapped majors. A risk label on the ticker
 *   would read as a verdict on the asset itself.
 * - The set below is large assets whose primary market is not Solana.
 *   A portal receipt or a copy under that symbol is not scored from the ticker.
 *   A contract address in the post is still scored as that exact mint.
 */

/** Large assets whose home chain is not Solana. Not an exhaustive market list. */
export const FOREIGN_MAJORS: ReadonlySet<string> = new Set([
  "AAVE",
  "ADA",
  "ALGO",
  "APT",
  "ARB",
  "ATOM",
  "AVAX",
  "BCH",
  "BNB",
  "BTC",
  "CRO",
  "DOGE",
  "DOT",
  "ETC",
  "ETH",
  "FIL",
  "HBAR",
  "ICP",
  "INJ",
  "KAS",
  "LEO",
  "LINK",
  "LTC",
  "MATIC",
  "MKR",
  "NEAR",
  "OKB",
  "OP",
  "PEPE",
  "POL",
  "SEI",
  "SHIB",
  "STX",
  "SUI",
  "TAO",
  "TIA",
  "TON",
  "TRX",
  "UNI",
  "VET",
  "XLM",
  "XMR",
  "XRP",
]);

export const WRAPPED_MAJORS: ReadonlySet<string> = new Set(["WBTC", "WETH", "WBNB"]);

/** Circle USDC and Tether USDT on Solana mainnet. */
export const SOLANA_STABLES: Readonly<Record<string, string>> = {
  USDC: USDC_MINT_MAINNET,
  USDT: USDT_MINT_MAINNET,
};

/** A notice for tickers Lens will not score. Null means look up a verified token. */
export function bareTickerNotice(symbol: string): string | null {
  const ticker = normalizeTicker(symbol);
  if (ticker === "SOL") return nativeSolReply();
  const stable = SOLANA_STABLES[ticker];
  if (stable) return stableTickerReply(ticker, stable);
  if (WRAPPED_MAJORS.has(ticker)) return wrappedMajorReply(ticker);
  if (FOREIGN_MAJORS.has(ticker)) return foreignTickerReply(ticker);
  return null;
}

export function verifiedMatchNotice(symbol: string, match: SymbolMatch): string | null {
  if (match.status === "unique") return null;
  if (match.status === "unavailable") return unavailableTickerReply(symbol);
  return ambiguousTickerReply(symbol);
}
