import { describe, expect, it } from "vitest";
import { decideSwapLink, publicActionBaseUrl, replyHasSwapLink, wantsTradeLink } from "./swap.js";

const MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

describe("trade intent", () => {
  it("matches a clear buy, swap, or trade request", () => {
    expect(wantsTradeLink("@justasklens buy $BONK")).toBe(true);
    expect(wantsTradeLink(`@justasklens swap ${MINT}`)).toBe(true);
    expect(wantsTradeLink("@justasklens trade $JUP")).toBe(true);
    expect(wantsTradeLink("please buy $BONK")).toBe(true);
    expect(wantsTradeLink("I want to buy $SAFE")).toBe(true);
    expect(wantsTradeLink("BUY $BONK")).toBe(true);
    expect(wantsTradeLink("don't buy, swap $BONK")).toBe(true);
  });

  it("ignores questions, refusals, and words that only look like the verb", () => {
    expect(wantsTradeLink("is $BONK safe to buy?")).toBe(false);
    expect(wantsTradeLink("should I buy $BONK?")).toBe(false);
    expect(wantsTradeLink("can I swap this?")).toBe(false);
    expect(wantsTradeLink("do I trade $JUP?")).toBe(false);
    expect(wantsTradeLink("don't buy $BONK")).toBe(false);
    expect(wantsTradeLink("do not trade this")).toBe(false);
    expect(wantsTradeLink("dont buy $BONK")).toBe(false);
    expect(wantsTradeLink("buying $BONK")).toBe(false);
    expect(wantsTradeLink("the buyer wants in")).toBe(false);
    expect(wantsTradeLink("is this legit?")).toBe(false);
    expect(wantsTradeLink("trade-off is unclear")).toBe(false);
  });
});

describe("public action URL", () => {
  it("accepts a public https origin and rejects local, http, and raw IPs", () => {
    expect(publicActionBaseUrl("https://asklens.com")).toBe("https://asklens.com");
    expect(publicActionBaseUrl("https://asklens.com/")).toBe("https://asklens.com");
    expect(publicActionBaseUrl("http://asklens.com")).toBeNull();
    expect(publicActionBaseUrl("http://127.0.0.1:3847")).toBeNull();
    expect(publicActionBaseUrl("https://127.0.0.1:3847")).toBeNull();
    expect(publicActionBaseUrl("https://localhost")).toBeNull();
    expect(publicActionBaseUrl("https://0.0.0.0")).toBeNull();
    expect(publicActionBaseUrl("https://10.1.2.3")).toBeNull();
    expect(publicActionBaseUrl("https://lens.local")).toBeNull();
    expect(publicActionBaseUrl("not a url")).toBeNull();
  });

  it("includes one blink URL for LOW and MEDIUM, and refuses HIGH", () => {
    const low = decideSwapLink({
      asked: true,
      enabled: true,
      publicBaseUrl: "https://asklens.com",
      riskLevel: "LOW",
      mint: MINT,
    });
    expect(low).toEqual({
      include: true,
      url: `https://asklens.com/api/actions/trade/${MINT}`,
    });
    const medium = decideSwapLink({
      asked: true,
      enabled: true,
      publicBaseUrl: "https://asklens.com/",
      riskLevel: "MEDIUM",
      mint: MINT,
    });
    expect(medium?.include).toBe(true);
    const high = decideSwapLink({
      asked: true,
      enabled: true,
      publicBaseUrl: "https://asklens.com",
      riskLevel: "HIGH",
      mint: MINT,
    });
    expect(high).toEqual({ include: false, reason: "HIGH risk has no buy link" });
  });

  it("stays quiet when nobody asked, and logs a reason when the link cannot be added", () => {
    expect(
      decideSwapLink({
        asked: false,
        enabled: true,
        publicBaseUrl: "https://asklens.com",
        riskLevel: "LOW",
        mint: MINT,
      }),
    ).toBeNull();
    const flagOff = decideSwapLink({
      asked: true,
      enabled: false,
      publicBaseUrl: "https://asklens.com",
      riskLevel: "LOW",
      mint: MINT,
    });
    expect(flagOff?.include).toBe(false);
    if (flagOff && !flagOff.include) expect(flagOff.reason).toMatch(/X_SWAP_LINKS_ON_REQUEST/);
    const local = decideSwapLink({
      asked: true,
      enabled: true,
      publicBaseUrl: "http://127.0.0.1:3847",
      riskLevel: "LOW",
      mint: MINT,
    });
    expect(local?.include).toBe(false);
    if (local && !local.include) expect(local.reason).toMatch(/public https/);
    const unscored = decideSwapLink({
      asked: true,
      enabled: true,
      publicBaseUrl: "https://asklens.com",
      riskLevel: "NONE",
      mint: "",
    });
    expect(unscored).toEqual({ include: false, reason: "token was not scored" });
    expect(replyHasSwapLink(`Swap: https://asklens.com/api/actions/trade/${MINT}`, MINT)).toBe(true);
    expect(replyHasSwapLink("no link here", MINT)).toBe(false);
  });
});
