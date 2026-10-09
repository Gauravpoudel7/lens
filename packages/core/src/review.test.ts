import { describe, expect, it } from "vitest";
import { needsReview, reviewReasons, type ReviewContext } from "./review.js";
import { emptyLinks } from "./risk/engine.js";
import type { CheckRecord, TokenSnapshot } from "./types.js";

function snapshot(mint: string, patch: Partial<TokenSnapshot>): TokenSnapshot {
  return {
    mint,
    symbol: "X",
    name: "X",
    decimals: 6,
    createdAt: null,
    priceUsd: null,
    liquidityUsd: null,
    lpLocked: null,
    top10HolderPct: null,
    creatorWallet: null,
    creatorSoldPct: null,
    creatorBalancePct: null,
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
    sniperPct: null,
    burnedPct: null,
    links: emptyLinks(mint),
    sources: ["dexscreener"],
    ...patch,
  };
}

function check(id: string, symbol: string, mint: string, patch: Partial<TokenSnapshot>, extra: Partial<CheckRecord> = {}): CheckRecord {
  const snap = snapshot(mint, patch);
  return {
    id,
    kind: "reply",
    mentionId: null,
    parentPostId: null,
    tokenMint: mint,
    tokenSymbol: symbol,
    tokenName: symbol,
    riskLevel: "MEDIUM",
    score: 0,
    dangerCount: 0,
    cautionCount: 0,
    unknownCount: 0,
    facts: [],
    snapshot: snap,
    claims: { burned: false, locked: false },
    sources: [],
    dataMode: "live",
    replyText: "",
    sourcePostText: `@justasklens is $${symbol} safe?`,
    priceAtCheck: snap.priceUsd,
    askedBy: null,
    status: "published",
    error: null,
    xPostId: null,
    createdAt: "2026-10-07T16:00:00.000Z",
    proof: null,
    outcome: null,
    ...extra,
  };
}

const ctx = (patch: Partial<ReviewContext>): ReviewContext => ({
  mintVerified: false,
  symbolHasVerified: false,
  supplyUi: null,
  current: null,
  ...patch,
});

describe("data review of older checks", () => {
  it("flags the four bad replies from 2026-10-07 and 2026-10-08", () => {
    const sol = check("QTqaoBJBqC", "SOL", "EPPiSnGoWRcAV8XhPEokxCw4y6CH2LV6nzSo1YsGSEnj", {
      liquidityUsd: 2_563_319_154,
      top10HolderPct: 99.99,
      priceUsd: 122.077,
    });
    expect(reviewReasons(sol, ctx({ symbolHasVerified: true, supplyUi: 20_999_999 }))).toEqual([
      "$SOL has a Jupiter-verified mint and this is not it",
      "top 10 shown as 100%",
    ]);

    const xrp = check("h8WbAPHY3D", "XRP", "69vXQQScU6Ra2mQ3p95JXmSq8LHjUbdAWvZ53SZ7H55E", {
      liquidityUsd: 1_562_018_532,
      top10HolderPct: 99.99,
      priceUsd: 1.56,
    });
    expect(reviewReasons(xrp, ctx({}))).toEqual([
      "scored from a bare $XRP ticker, but the mint is not Jupiter-verified",
      "top 10 shown as 100%",
    ]);

    const copy = check("uiD72UvHDt", "JUP", "JUPrJXKV6MyLkbFgZMDXPn7mYR4yqMNn5Pwg27zcyyG", {
      liquidityUsd: 40_462_994,
      top10HolderPct: 99.99,
    });
    expect(reviewReasons(copy, ctx({ symbolHasVerified: true }))).toHaveLength(2);

    const jup = check("8rLaGKcU94", "JUP", "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", {
      liquidityUsd: 965_147_702,
      top10HolderPct: 66.19,
      priceUsd: 1656.9,
    });
    const now = snapshot(jup.tokenMint, { liquidityUsd: 4_548_690 });
    expect(reviewReasons(jup, ctx({ mintVerified: true, symbolHasVerified: true, supplyUi: 6_861_486_301, current: now }))).toEqual([
      "liquidity $965,147,702 is not backed by today's pools ($4,548,690)",
    ]);
  });

  it("keeps a good Bonk check, including one whose liquidity has since grown", () => {
    const bonk = check("H7CZMV6Fnu", "Bonk", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", {
      liquidityUsd: 394_000,
      top10HolderPct: 38.6,
      priceUsd: 0.0000034,
    });
    const now = snapshot(bonk.tokenMint, { liquidityUsd: 1_527_972 });
    expect(
      reviewReasons(bonk, ctx({ mintVerified: true, symbolHasVerified: true, supplyUi: 88_000_000_000_000, current: now })),
    ).toEqual([]);
  });

  it("flags liquidity above FDV at the check's price", () => {
    const thin = check("thin", "THIN", "Thin1111111111111111111111111111111111111111", {
      liquidityUsd: 50_000,
      priceUsd: 0.00001,
    }, { sourcePostText: "CA Thin1111111111111111111111111111111111111111" });
    expect(reviewReasons(thin, ctx({ supplyUi: 1_000_000_000 }))).toEqual(["liquidity $50,000 is above FDV $10,000"]);
  });

  it("reviews only older live scored checks", () => {
    const base = check("a", "BONK", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", {});
    expect(needsReview(base)).toBe(true);
    expect(needsReview({ ...base, dataVersion: 2 })).toBe(false);
    expect(needsReview({ ...base, dataMode: "mock" })).toBe(false);
    expect(needsReview({ ...base, riskLevel: "NONE" })).toBe(false);
    expect(needsReview({ ...base, status: "hidden" })).toBe(false);
  });
});
