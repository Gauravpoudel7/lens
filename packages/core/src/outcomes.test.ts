import { describe, expect, it } from "vitest";
import { computeStats, judgeOutcome, sharpeRatio } from "./outcomes.js";
import type { CheckRecord } from "./types.js";

describe("outcome scoring", () => {
  it("marks a sharp drop after a HIGH label as correct", () => {
    const result = judgeOutcome({
      kind: "reply",
      riskLevel: "HIGH",
      priceAtCheck: 0.00012,
      priceAtScore: 0.00002,
      sharpDropPct: -30,
      callWinPct: 20,
    });
    expect(result.priceChangePct).toBeLessThan(-30);
    expect(result.labelCorrect).toBe(true);
    expect(result.callResult).toBe("n/a");
  });

  it("marks a LOW label wrong when the price drops sharply", () => {
    const result = judgeOutcome({
      kind: "call",
      riskLevel: "LOW",
      priceAtCheck: 1,
      priceAtScore: 0.4,
      sharpDropPct: -30,
      callWinPct: 20,
    });
    expect(result.labelCorrect).toBe(false);
    expect(result.callResult).toBe("loss");
  });

  it("counts a call as a win only past the threshold", () => {
    const win = judgeOutcome({
      kind: "call",
      riskLevel: "LOW",
      priceAtCheck: 1.25,
      priceAtScore: 1.62,
      sharpDropPct: -30,
      callWinPct: 20,
    });
    expect(win.callResult).toBe("win");
    expect(win.labelCorrect).toBe(true);
    const flat = judgeOutcome({
      kind: "call",
      riskLevel: "LOW",
      priceAtCheck: 1,
      priceAtScore: 1.05,
      sharpDropPct: -30,
      callWinPct: 20,
    });
    expect(flat.callResult).toBe("flat");
  });

  it("computes win rate, label accuracy, and sharpe from saved rows", () => {
    const checks = [
      row("call", "LOW", "win", true, 29),
      row("call", "LOW", "loss", false, -40),
      row("reply", "HIGH", "n/a", true, -80),
    ];
    const stats = computeStats(checks, { windowDays: 7, sharpDropPct: -30, callWinPct: 20 });
    expect(stats.callWinRate).toBe(0.5);
    expect(stats.highRiskDropRate).toBe(1);
    expect(stats.labelAccuracy).toBeCloseTo(2 / 3);
    expect(stats.sharpe).not.toBeNull();
    expect(sharpeRatio([0.2])).toBeNull();
  });
});

function row(
  kind: CheckRecord["kind"],
  riskLevel: CheckRecord["riskLevel"],
  callResult: NonNullable<CheckRecord["outcome"]>["callResult"],
  labelCorrect: boolean | null,
  priceChangePct: number,
): CheckRecord {
  return {
    id: `${kind}-${riskLevel}-${callResult}`,
    kind,
    mentionId: null,
    parentPostId: null,
    tokenMint: "mint",
    tokenSymbol: "T",
    tokenName: "T",
    riskLevel,
    score: 0,
    dangerCount: 0,
    cautionCount: 0,
    unknownCount: 0,
    facts: [],
    snapshot: null,
    claims: { burned: false, locked: false },
    sources: [],
    dataMode: "mock",
    replyText: "Not financial advice.",
    sourcePostText: null,
    priceAtCheck: 1,
    askedBy: null,
    status: "published",
    error: null,
    xPostId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    proof: null,
    outcome: {
      priceAtCheck: 1,
      priceAtScore: 1,
      priceChangePct,
      windowDays: 7,
      labelCorrect,
      callResult,
      scoredAt: "2026-09-08T00:00:00.000Z",
    },
  };
}
