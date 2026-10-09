import { DISCLAIMER } from "../reply/policy.js";
import { safeSymbol } from "../reply/sanitize.js";
import { CHECK_DATA_VERSION, type CheckRecord, type TokenSnapshot } from "../types.js";
import { assertEditorialText } from "./compose.js";

const COUNTED_KINDS = new Set<CheckRecord["kind"]>(["reply", "call", "warning", "note"]);
const MIN_COINS = 3;
const HOUR_MS = 3_600_000;

/** Checks a recap may count: live, scored, public, and made under the current data rules. */
export function recapChecks(checks: CheckRecord[]): CheckRecord[] {
  return checks.filter(
    (check) =>
      COUNTED_KINDS.has(check.kind) &&
      check.dataMode === "live" &&
      check.riskLevel !== "NONE" &&
      check.status !== "hidden" &&
      (check.dataVersion ?? 1) >= CHECK_DATA_VERSION &&
      check.tokenMint.length > 0,
  );
}

/**
 * Option A: Lens's own day. Coins are counted once each (latest check wins).
 * Null under 3 coins, so the caller can fall back to the market recap.
 */
export function buildActivityRecap(checks: CheckRecord[], cluster: string): string | null {
  const counted = recapChecks(checks).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const latest = new Map<string, CheckRecord>();
  const asks = new Map<string, number>();
  for (const check of counted) {
    latest.set(check.tokenMint, check);
    asks.set(check.tokenMint, (asks.get(check.tokenMint) ?? 0) + 1);
  }
  if (latest.size < MIN_COINS) return null;

  const coins = [...latest.values()];
  const levels = (["HIGH", "MEDIUM", "LOW"] as const)
    .map((level) => ({ level, count: coins.filter((check) => check.riskLevel === level).length }))
    .filter((row) => row.count > 0)
    .map((row) => `${row.count} ${row.level}`);
  const lines = ["📊 Lens today", `• ${coins.length} coins checked`];
  if (levels.length) lines.push(`• ${levels.join(" · ")}`);

  const ranked = [...asks.entries()].sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  if (top && (!second || second[1] < top[1])) {
    const check = latest.get(top[0])!;
    lines.push(`• Most asked: $${safeSymbol(check.tokenSymbol, check.tokenMint)}`);
  }
  if (counted.every((check) => check.proof?.status === "confirmed" && check.proof.cluster === cluster)) {
    lines.push(`• Every answer has an on-chain proof (Solana ${cluster})`);
  }
  lines.push(DISCLAIMER);
  return assertEditorialText(lines.join("\n"));
}

/**
 * Option B: risk-first look at trending coins, used only when Option A is null.
 * A row counts only when a real pool holding the mint survived the plausibility gate.
 * No prices, no %, no cashtags, no buy or sell words. Null under 3 coins.
 */
export function buildMarketRecap(rows: Array<TokenSnapshot | null>, now = new Date()): string | null {
  const coins = rows.filter((row): row is TokenSnapshot => row != null && row.liquidityUsd != null);
  if (coins.length < MIN_COINS) return null;
  const canMint = coins.filter((coin) => coin.mintAuthorityActive === true).length;
  const frozen = coins.filter((coin) => coin.freezeAuthorityActive === true).length;
  const dated = coins
    .map((coin) => ({ coin, created: coin.createdAt ? Date.parse(coin.createdAt) : Number.NaN }))
    .filter((row) => Number.isFinite(row.created) && row.created <= now.getTime());
  const young = dated.filter((row) => now.getTime() - row.created < 24 * HOUR_MS).length;
  const newest = [...dated].sort((a, b) => b.created - a.created)[0];

  const lines = [`📊 Trending on Solana today, Lens checked ${coins.length}`];
  if (canMint > 0) lines.push(`• ${canMint} can still mint new coins`);
  if (frozen > 0) lines.push(`• ${frozen} ${frozen === 1 ? "has" : "have"} freeze on`);
  if (young > 0) lines.push(`• ${young} ${young === 1 ? "is" : "are"} under 1 day old`);
  if (newest) {
    const ticker = safeSymbol(newest.coin.symbol.replace(/^\$+/, ""), newest.coin.mint);
    lines.push(`• Newest: ${ticker} (${ageLabel(now.getTime() - newest.created)})`);
  }
  lines.push(DISCLAIMER);
  const text = lines.join("\n");
  if (/\$[A-Za-z]/.test(text) || text.includes("%") || /\b(buy|sell|ape)\b/i.test(text)) return null;
  try {
    return assertEditorialText(text);
  } catch {
    return null;
  }
}

function ageLabel(ms: number): string {
  const hours = Math.floor(ms / HOUR_MS);
  if (hours < 1) return "under 1 hour old";
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} old`;
  return `${Math.floor(hours / 24)} days old`;
}
