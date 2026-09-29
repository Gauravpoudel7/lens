import type { LensStore } from "./store/types.js";
import type { CallResult, CheckKind, CheckRecord, OutcomeRecord, RiskLevel } from "./types.js";
import type { TokenDataProvider } from "./providers/types.js";

export interface OutcomeThresholds {
  sharpDropPct: number;
  callWinPct: number;
  windowDays: number;
}

export interface OutcomeJudgement {
  priceChangePct: number | null;
  labelCorrect: boolean | null;
  callResult: CallResult;
}

export function priceChangePct(priceAtCheck: number | null, priceAtScore: number | null): number | null {
  if (priceAtCheck == null || priceAtScore == null || priceAtCheck <= 0) return null;
  const change = ((priceAtScore - priceAtCheck) / priceAtCheck) * 100;
  return Math.round(change * 100) / 100;
}

export function judgeOutcome(input: {
  kind: CheckKind;
  riskLevel: RiskLevel | "NONE";
  priceAtCheck: number | null;
  priceAtScore: number | null;
  sharpDropPct: number;
  callWinPct: number;
}): OutcomeJudgement {
  const change = priceChangePct(input.priceAtCheck, input.priceAtScore);
  if (change == null || input.riskLevel === "NONE") {
    return { priceChangePct: change, labelCorrect: null, callResult: "unscored" };
  }
  let labelCorrect: boolean | null = null;
  if (input.riskLevel === "HIGH") labelCorrect = change <= input.sharpDropPct;
  else if (input.riskLevel === "LOW") labelCorrect = change > input.sharpDropPct;

  let callResult: CallResult = "n/a";
  if (input.kind === "call") {
    if (change >= input.callWinPct) callResult = "win";
    else if (change <= -input.callWinPct) callResult = "loss";
    else callResult = "flat";
  } else if (input.kind === "warning") {
    callResult = change <= input.sharpDropPct ? "correct" : "incorrect";
  }
  return { priceChangePct: change, labelCorrect, callResult };
}

export interface ScorecardStats {
  totalChecks: number;
  scoredChecks: number;
  callWinRate: number | null;
  callSample: number;
  highRiskDropRate: number | null;
  highRiskSample: number;
  lowRiskHeldRate: number | null;
  lowRiskSample: number;
  labelAccuracy: number | null;
  labelSample: number;
  sharpe: number | null;
  windowDays: number;
  sharpDropPct: number;
  callWinPct: number;
}

export function computeStats(checks: CheckRecord[], thresholds: OutcomeThresholds): ScorecardStats {
  const visible = checks.filter((check) => check.kind !== "unresolved" && check.riskLevel !== "NONE");
  const calls = visible.filter((check) => check.kind === "call" && check.outcome?.callResult);
  const decidedCalls = calls.filter((check) =>
    ["win", "loss", "flat"].includes(check.outcome?.callResult ?? ""),
  );
  const wins = decidedCalls.filter((check) => check.outcome?.callResult === "win");
  const highs = visible.filter(
    (check) => check.riskLevel === "HIGH" && check.outcome?.labelCorrect != null,
  );
  const lows = visible.filter(
    (check) => check.riskLevel === "LOW" && check.outcome?.labelCorrect != null,
  );
  const labeled = [...highs, ...lows];
  const returns = decidedCalls
    .map((check) => check.outcome?.priceChangePct)
    .filter((value): value is number => value != null)
    .map((value) => value / 100);

  return {
    totalChecks: visible.length,
    scoredChecks: visible.filter((check) => check.outcome && check.outcome.callResult !== "unscored").length,
    callWinRate: decidedCalls.length ? wins.length / decidedCalls.length : null,
    callSample: decidedCalls.length,
    highRiskDropRate: highs.length
      ? highs.filter((check) => check.outcome?.labelCorrect).length / highs.length
      : null,
    highRiskSample: highs.length,
    lowRiskHeldRate: lows.length
      ? lows.filter((check) => check.outcome?.labelCorrect).length / lows.length
      : null,
    lowRiskSample: lows.length,
    labelAccuracy: labeled.length
      ? labeled.filter((check) => check.outcome?.labelCorrect).length / labeled.length
      : null,
    labelSample: labeled.length,
    sharpe: sharpeRatio(returns),
    windowDays: thresholds.windowDays,
    sharpDropPct: thresholds.sharpDropPct,
    callWinPct: thresholds.callWinPct,
  };
}

export function sharpeRatio(returns: number[]): number | null {
  if (returns.length < 2) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  const deviation = Math.sqrt(variance);
  if (deviation === 0) return null;
  return Math.round((mean / deviation) * 100) / 100;
}

export async function scoreDueChecks(
  deps: {
    store: LensStore;
    provider: TokenDataProvider;
    config: OutcomeThresholds;
  },
  opts?: { now?: Date; windowDays?: number },
): Promise<number> {
  const now = opts?.now ?? new Date();
  const windowDays = opts?.windowDays ?? deps.config.windowDays;
  const cutoff = new Date(now.getTime() - windowDays * 86_400_000).toISOString();
  const due = await deps.store.listUnscored(cutoff);
  let scored = 0;
  for (const check of due) {
    if (check.priceAtCheck == null) {
      await deps.store.saveOutcome(check.id, {
        priceAtCheck: null,
        priceAtScore: null,
        priceChangePct: null,
        windowDays,
        labelCorrect: null,
        callResult: "unscored",
        scoredAt: now.toISOString(),
      });
      scored += 1;
      continue;
    }
    let priceAtScore: number | null = null;
    try {
      priceAtScore = await deps.provider.getPrice(check.tokenMint);
    } catch {
      continue;
    }
    if (priceAtScore == null) continue;
    const judgement = judgeOutcome({
      kind: check.kind,
      riskLevel: check.riskLevel,
      priceAtCheck: check.priceAtCheck,
      priceAtScore,
      sharpDropPct: deps.config.sharpDropPct,
      callWinPct: deps.config.callWinPct,
    });
    const outcome: OutcomeRecord = {
      priceAtCheck: check.priceAtCheck,
      priceAtScore,
      priceChangePct: judgement.priceChangePct,
      windowDays,
      labelCorrect: judgement.labelCorrect,
      callResult: judgement.callResult,
      scoredAt: now.toISOString(),
    };
    await deps.store.saveOutcome(check.id, outcome);
    scored += 1;
  }
  return scored;
}
