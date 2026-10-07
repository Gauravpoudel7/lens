import type { Signal } from "@lens/core";

/** What each rule is measuring, in plain words. The finding itself stays in fact.text. */
export const FACT_MEANING: Record<string, string> = {
  coin_age:
    "Age is how long a trading pool for this mint has existed. A mint from the last day has almost no history. Under a week is still early.",
  liquidity:
    "Liquidity is the money in the pool. A thin pool lets a small sale move the price a lot. Unlocked liquidity can be removed.",
  top_holders:
    "This is the share held by the ten largest wallets. A high share means a few holders can sell into everyone else.",
  creator_wallet:
    "This looks at whether the creating wallet has been selling. “Could not be verified” means the sells were not visible. It does not mean they were fine.",
  mint_authority:
    "Mint authority is the right to create more tokens. If it is still on, supply can grow. Stake-pool receipt tokens keep it on so the pool can issue shares.",
  freeze_authority: "Freeze authority is the right to freeze accounts so the tokens in them cannot be moved.",
  snipers:
    "These are linked wallets that bought at launch. A large share means early buyers still hold a lot of the supply.",
  claims: "This compares a burn or lock claim in the post with what the chain actually shows.",
  incomplete:
    "Too many checks came back unknown to call this a clear pass. Missing data is not treated as low risk.",
};

export function signalLabel(signal: Signal): string {
  if (signal === "danger") return "Danger";
  if (signal === "caution") return "Caution";
  if (signal === "good") return "In range";
  return "Not verified";
}

export function levelName(level: string): string {
  if (level === "HIGH") return "High risk";
  if (level === "MEDIUM") return "Medium risk";
  if (level === "LOW") return "Low risk";
  if (level === "NONE") return "No token";
  return level;
}
