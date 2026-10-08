import type { Signal } from "@lens/core";

/** What each rule measures, in one plain line. The finding itself stays in fact.text. */
export const FACT_MEANING: Record<string, string> = {
  coin_age: "How long this token has been trading. Under a day means almost no history.",
  liquidity: "Money in the trading pool. A thin pool lets a small sale move the price a lot.",
  top_holders: "Share held by the 10 largest wallets. A high share means a few people can sell into everyone else.",
  creator_wallet: "Whether the wallet that made the token has been selling. Not verified does not mean fine.",
  mint_authority: "Whether someone can still create more tokens.",
  freeze_authority: "Whether someone can freeze wallets so the token cannot be moved.",
  snipers: "Linked wallets that bought at launch and may still hold a lot.",
  claims: "Whether a burn or lock claim in the post matches the chain.",
  incomplete: "Too many checks came back unknown to call this a pass.",
};

/** What Lens looks at, in the order the report shows it. */
export const CHECK_LIST = [
  "How old the token is",
  "Money in the trading pool",
  "Share held by the top 10 wallets",
  "Whether the creator is selling",
  "Whether more tokens can be minted",
  "Whether wallets can be frozen",
  "Wallets that bought at launch",
  "Burn or lock claims in a post",
  "Token-2022 traps (fees, hooks, delegates)",
];

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
  if (level === "NONE") return "Not scored";
  return level;
}
