import { describe, expect, it } from "vitest";
import { isSolanaAddress } from "./discover.js";
import { jupiterSwapUrl, tradePageUrl, tradeView } from "./trade.js";
import type { CheckRecord, Fact } from "./types.js";

const MINT = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";

function fact(id: string, signal: Fact["signal"], short: string): Fact {
  return { id, signal, text: short, short, sourceUrl: null, sourceLabel: null } as Fact;
}

function check(level: CheckRecord["riskLevel"], facts: Fact[]): CheckRecord {
  return {
    id: "chk_1",
    kind: "blink",
    tokenMint: MINT,
    tokenSymbol: "JUP",
    riskLevel: level,
    facts,
    createdAt: "2026-10-08T10:00:00.000Z",
  } as CheckRecord;
}

const GOOD = [fact("mint_authority", "good", "Mint authority off"), fact("freeze_authority", "good", "Freeze authority off")];

describe("trade page view", () => {
  it("LOW gets a Jupiter buy link and no caution line", () => {
    const view = tradeView(check("LOW", GOOD));
    expect(view.buyUrl).toBe(jupiterSwapUrl(MINT));
    expect(view.caution).toBeNull();
    expect(view.shortMint).toBe("JUPy…DvCN");
    expect(view.reportPath).toBe("/r/chk_1");
  });

  it("MEDIUM keeps the buy link and lists the caution facts above it", () => {
    const view = tradeView(check("MEDIUM", [...GOOD, fact("top_holders", "caution", "Top 10 hold 66%."), fact("liquidity", "caution", "Liquidity $24k.")]));
    expect(view.buyUrl).toBe(jupiterSwapUrl(MINT));
    expect(view.caution).toBe("Top 10 hold 66% · Liquidity $24k");
  });

  it("HIGH and unscored tokens get no buy link", () => {
    expect(tradeView(check("HIGH", [fact("top_holders", "danger", "Top 10 hold 86%")])).buyUrl).toBeNull();
    expect(tradeView(check("NONE", [])).buyUrl).toBeNull();
  });

  it("shows at most three facts, worst first, and skips unknowns", () => {
    const view = tradeView(
      check("HIGH", [
        ...GOOD,
        fact("creator_wallet", "unknown", "Creator sells unknown"),
        fact("liquidity", "caution", "Liquidity $24k"),
        fact("top_holders", "danger", "Top 10 hold 86%"),
      ]),
    );
    expect(view.facts.map((f) => f.text)).toEqual(["Top 10 hold 86%", "Liquidity $24k", "Mint authority off"]);
  });

  it("links to Jupiter with SOL in and the mint out, and nothing else", () => {
    const url = new URL(jupiterSwapUrl(MINT));
    expect(url.origin + url.pathname).toBe("https://jup.ag/swap");
    expect([...url.searchParams.keys()]).toEqual(["sell", "buy"]);
    expect(url.searchParams.get("sell")).toBe("So11111111111111111111111111111111111111112");
    expect(url.searchParams.get("buy")).toBe(MINT);
  });

  it("builds the page URL and rejects addresses that are not Solana mints", () => {
    expect(tradePageUrl("https://asklens.com/", MINT)).toBe(`https://asklens.com/trade/${MINT}`);
    expect(isSolanaAddress(MINT)).toBe(true);
    expect(isSolanaAddress("not-a-mint")).toBe(false);
    expect(isSolanaAddress("0x1234")).toBe(false);
  });
});
