import { TRADE_CHECK_MAX_AGE_MS, createRiskCheck, type CheckRecord } from "@lens/core";
import type { LensRuntime } from "@lens/db";

export type TradeCheckResult =
  | { check: CheckRecord }
  | { check: null; error: "rate_limited" | "token_not_found" | "proof_failed" | "unavailable"; detail?: string };

/**
 * Shared by `/trade/<mint>` and the Blink route. A fresh stored check is reused as-is.
 * Otherwise `allow()` (the per-IP hourly limit) must pass before a new check runs, so page views
 * cannot spend data-provider credits or proof memos. New checks are kind `blink`, which the scorecard leaves out.
 */
export async function loadTradeCheck(rt: LensRuntime, mint: string, allow: () => boolean): Promise<TradeCheckResult> {
  const recent = await rt.store.latestCheckForMint(mint, TRADE_CHECK_MAX_AGE_MS);
  if (recent && recent.riskLevel !== "NONE") return { check: recent };
  if (!allow()) return { check: null, error: "rate_limited" };
  const created = await createRiskCheck(rt, { kind: "blink", mint, claimText: "" });
  if (created.ok) return { check: created.check };
  if (created.error === "token_not_found" || created.error === "proof_failed") {
    return { check: null, error: created.error, detail: created.detail };
  }
  return { check: null, error: "unavailable", detail: "detail" in created ? created.detail : undefined };
}
