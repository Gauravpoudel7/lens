import { USDC_MINT_MAINNET, USDT_MINT_MAINNET } from "../config.js";
import { isSolanaAddress } from "../discover.js";
import { errorMessage, log } from "../ids.js";
import { normalizeTicker } from "../providers/parse.js";
import { WSOL_MINT } from "../providers/jupiter.js";
import type { TokenDataProvider } from "../providers/types.js";
import { FOREIGN_MAJORS, WRAPPED_MAJORS } from "../tickers.js";
import type { TokenSnapshot } from "../types.js";

/** Free, about 30 requests a minute. One request per recap. */
export const TRENDING_URL = "https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?include=base_token";

const SKIP_MINTS = new Set([WSOL_MINT, USDC_MINT_MAINNET, USDT_MINT_MAINNET]);
const SKIP_SYMBOLS = new Set(["SOL", "WSOL", "USDC", "USDT"]);

export interface TrendingCoin {
  mint: string;
  symbol: string | null;
}

/** Base tokens of trending pools, deduped, without SOL, stables, and non-Solana majors. Top 10. */
export function parseTrendingPools(body: unknown): TrendingCoin[] {
  const root = (body && typeof body === "object" ? body : {}) as { data?: unknown; included?: unknown };
  const pools = Array.isArray(root.data) ? (root.data as Array<Record<string, unknown>>) : [];
  const tokens = new Map<string, { address?: string; symbol?: string }>();
  for (const row of Array.isArray(root.included) ? (root.included as Array<Record<string, unknown>>) : []) {
    if (typeof row.id === "string" && row.attributes && typeof row.attributes === "object") {
      tokens.set(row.id, row.attributes as { address?: string; symbol?: string });
    }
  }
  const out: TrendingCoin[] = [];
  const seen = new Set<string>();
  for (const pool of pools) {
    const base = (pool.relationships as { base_token?: { data?: { id?: string } } } | undefined)?.base_token?.data?.id;
    if (!base) continue;
    const token = tokens.get(base);
    const mint = token?.address ?? base.replace(/^solana_/, "");
    const symbol = typeof token?.symbol === "string" ? token.symbol : null;
    const ticker = symbol ? normalizeTicker(symbol) : "";
    if (!isSolanaAddress(mint) || seen.has(mint) || SKIP_MINTS.has(mint)) continue;
    if (SKIP_SYMBOLS.has(ticker) || FOREIGN_MAJORS.has(ticker) || WRAPPED_MAJORS.has(ticker)) continue;
    seen.add(mint);
    out.push({ mint, symbol });
  }
  return out.slice(0, 10);
}

/** One GET with a 10 s timeout. Any error returns [] so the recap is skipped. */
export async function listTrendingSolana(fetchImpl: typeof fetch = fetch): Promise<TrendingCoin[]> {
  try {
    const response = await fetchImpl(TRENDING_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for GeckoTerminal trending pools`);
    return parseTrendingPools(await response.json());
  } catch (err) {
    log("trending pools failed", errorMessage(err));
    return [];
  }
}

/** Reads the first 5 coins through the provider, which applies the plausibility gate. */
export async function loadMarketRows(
  provider: TokenDataProvider,
  coins: TrendingCoin[],
): Promise<Array<TokenSnapshot | null>> {
  const rows: Array<TokenSnapshot | null> = [];
  for (const coin of coins.slice(0, 5)) {
    rows.push(await provider.getToken(coin.mint).catch(() => null));
  }
  return rows;
}
