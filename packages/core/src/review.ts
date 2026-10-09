import { extractTokenCandidates } from "./resolver.js";
import { CHECK_DATA_VERSION, type CheckRecord, type TokenSnapshot } from "./types.js";

/** Facts about a check's token today, read by the fixed live reader. */
export interface ReviewContext {
  /** This mint is on Jupiter's verified list. */
  mintVerified: boolean;
  /** Jupiter's verified list has at least one token with the symbol the check showed. */
  symbolHasVerified: boolean;
  /** Current supply in whole tokens, for FDV at the check's price. */
  supplyUi: number | null;
  /** The token as the fixed reader sees it now. */
  current: TokenSnapshot | null;
}

/** Live, scored checks made before the current data rules. Mock fixtures and notices are skipped. */
export function needsReview(check: CheckRecord): boolean {
  return (
    (check.dataVersion ?? 1) < CHECK_DATA_VERSION &&
    check.status !== "hidden" &&
    check.dataMode === "live" &&
    check.riskLevel !== "NONE" &&
    check.tokenMint.length > 0 &&
    check.snapshot != null
  );
}

/** Why an older check should leave the public scorecard. Empty means keep it. */
export function reviewReasons(check: CheckRecord, ctx: ReviewContext): string[] {
  const reasons: string[] = [];
  const symbol = check.tokenSymbol;
  if (!ctx.mintVerified) {
    if (ctx.symbolHasVerified) {
      reasons.push(`$${symbol} has a Jupiter-verified mint and this is not it`);
    } else if (check.kind === "reply" && extractTokenCandidates(check.sourcePostText ?? "").mints.length === 0) {
      reasons.push(`scored from a bare $${symbol} ticker, but the mint is not Jupiter-verified`);
    }
  }
  const top10 = check.snapshot?.top10HolderPct ?? null;
  if (top10 != null && top10 >= 99.5) reasons.push(`top 10 shown as ${Math.round(top10)}%`);
  const liquidity = check.snapshot?.liquidityUsd ?? null;
  const fdv = ctx.supplyUi != null && check.priceAtCheck != null ? ctx.supplyUi * check.priceAtCheck : null;
  if (liquidity != null && fdv != null && fdv > 0 && liquidity > fdv) {
    reasons.push(`liquidity ${usd(liquidity)} is above FDV ${usd(fdv)}`);
  }
  // A verified token does not lose 90% of its depth in days, so this is a bad read, not a rug.
  const now = ctx.current?.liquidityUsd ?? null;
  if (ctx.mintVerified && liquidity != null && liquidity >= 1_000_000 && (now == null || liquidity >= now * 10)) {
    reasons.push(`liquidity ${usd(liquidity)} is not backed by today's pools (${now == null ? "none verified" : usd(now)})`);
  }
  return reasons;
}

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
