import type { CheckRecord, Fact, RiskLevel } from "./types.js";
import { shortMint } from "./reply/policy.js";

/** A stored check younger than this is reused by `/trade` and the Blink route instead of running a new one. */
export const TRADE_CHECK_MAX_AGE_MS = 15 * 60 * 1000;

const SOL_MINT = "So11111111111111111111111111111111111111112";

/**
 * Jupiter's swap page with SOL to sell and `mint` to buy. Checked against jup.ag on 2026-10-08:
 * `?sell=&buy=` prefills both sides; the older `/swap/SOL-<mint>` path falls back to USDC.
 */
export function jupiterSwapUrl(mint: string): string {
  return `https://jup.ag/swap?sell=${SOL_MINT}&buy=${mint}`;
}

/** The human page the reply swap link points at. `actions.json` maps it to the Blink API. */
export function tradePageUrl(base: string, mint: string): string {
  return `${base.replace(/\/$/, "")}/trade/${mint}`;
}

const RANK: Record<Fact["signal"], number> = { danger: 0, caution: 1, good: 2, unknown: 3 };

export interface TradeView {
  symbol: string;
  mint: string;
  shortMint: string;
  level: RiskLevel | "NONE";
  facts: Array<{ text: string; signal: Fact["signal"] }>;
  /** Null for HIGH and unscored tokens. This is the only place the page decides whether a buy link exists. */
  buyUrl: string | null;
  reportPath: string;
  checkedAt: string;
}

export function tradeView(check: CheckRecord): TradeView {
  const known = check.facts.filter((fact) => fact.signal !== "unknown" && fact.id !== "incomplete");
  const ranked = (known.length ? known : check.facts)
    .slice()
    .sort((a, b) => RANK[a.signal] - RANK[b.signal])
    .slice(0, 3)
    .map((fact) => ({ text: fact.short, signal: fact.signal }));
  const canBuy = check.riskLevel === "LOW" || check.riskLevel === "MEDIUM";
  return {
    symbol: check.tokenSymbol,
    mint: check.tokenMint,
    shortMint: shortMint(check.tokenMint),
    level: check.riskLevel,
    facts: ranked,
    buyUrl: canBuy ? jupiterSwapUrl(check.tokenMint) : null,
    reportPath: `/r/${check.id}`,
    checkedAt: check.createdAt,
  };
}
