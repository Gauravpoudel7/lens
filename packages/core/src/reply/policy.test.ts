import { describe, expect, it } from "vitest";
import { evaluateRisk, type RuleInput } from "../risk/engine.js";
import {
  ambiguousTickerReply,
  assertSafeNotice,
  buildTemplateReply,
  enforceReplyPolicy,
  foreignTickerReply,
  nativeSolReply,
  shortMint,
  stableTickerReply,
  stripReplyUrls,
  UNRESOLVED_REPLY,
  wrappedMajorReply,
  type ReplyDraftInput,
} from "./policy.js";

const input: ReplyDraftInput = {
  riskLevel: "HIGH",
  symbol: "DANGER",
  name: "Danger Token",
  reportUrl: "http://127.0.0.1:3847/r/abc",
  facts: [
    {
      id: "mint_authority",
      signal: "danger",
      text: "Mint authority is still on, so more tokens can be created.",
      short: "Mint authority is still on.",
      sourceUrl: null,
      sourceLabel: null,
    },
    {
      id: "creator_wallet",
      signal: "danger",
      text: "The creator wallet has sold 60% of its tokens.",
      short: "Creator sold 60%.",
      sourceUrl: null,
      sourceLabel: null,
    },
  ],
};

describe("reply policy", () => {
  it("builds a link-free template that states the level and ends with the disclaimer", () => {
    const text = buildTemplateReply(input);
    expect(text).toContain("HIGH");
    expect(text).not.toContain("Full report");
    expect(text).not.toContain(input.reportUrl);
    expect(text).not.toMatch(/https?:\/\//);
    expect(text.endsWith("Not financial advice.")).toBe(true);
    expect(text).not.toMatch(/scam/i);
    expect(text.length).toBeLessThanOrEqual(280);
  });

  it("keeps the report URL when links are turned on", () => {
    const linked = { ...input, includeLinks: true };
    const text = buildTemplateReply(linked);
    expect(text).toContain(`Report: ${input.reportUrl}`);
    const repaired = enforceReplyPolicy("This is HIGH risk.\nNot financial advice.", linked);
    expect(repaired.ok).toBe(true);
    if (repaired.ok) expect(repaired.text).toContain(input.reportUrl);
  });

  it("strips accusations and does not put the report URL back", () => {
    const cleaned = enforceReplyPolicy(
      "This scam is HIGH risk. Report: http://127.0.0.1:3847/r/abc",
      input,
    );
    expect(cleaned.ok).toBe(true);
    if (cleaned.ok) {
      expect(cleaned.text).not.toMatch(/scam/i);
      expect(cleaned.text).not.toContain(input.reportUrl);
      expect(cleaned.text).not.toContain("Full report");
      expect(cleaned.text.endsWith("Not financial advice.")).toBe(true);
    }
    const conflicted = enforceReplyPolicy("Actually this is LOW risk.\nNot financial advice.", input);
    expect(conflicted.ok).toBe(false);
  });

  it("strips https, t.co, and bare domains without eating prices or tickers", () => {
    const raw = [
      "$BONK is HIGH risk. Liquidity is $1.5 and holders are 39%.",
      "See https://dexscreener.com/solana/abc and t.co/xyz plus dexscreener.com/solana/abc.",
      "Not financial advice.",
    ].join("\n");
    const stripped = stripReplyUrls(raw);
    expect(stripped).toContain("$BONK");
    expect(stripped).toContain("1.5");
    expect(stripped).toContain("39%");
    expect(stripped).not.toMatch(/https?:\/\//);
    expect(stripped).not.toMatch(/t\.co/);
    expect(stripped).not.toMatch(/dexscreener\.com/);
    const enforced = enforceReplyPolicy(raw, { ...input, symbol: "BONK" });
    expect(enforced.ok).toBe(true);
    if (enforced.ok) {
      expect(enforced.text).not.toMatch(/https?:\/\/|t\.co|dexscreener\.com/);
      expect(enforced.text).not.toContain("Full report");
      expect(enforced.text.endsWith("Not financial advice.")).toBe(true);
    }
  });

  it("names a public site in plain text and still strips other domains", () => {
    const named = buildTemplateReply({ ...input, siteLabel: "asklens.xyz", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" });
    expect(named).toContain("Full report on asklens.xyz.");
    expect(named).toContain("JUPy…DvCN");
    expect(named).not.toMatch(/https?:\/\//);
    const enforced = enforceReplyPolicy(
      "$DANGER: HIGH risk.\nSee dexscreener.com/solana/abc.\nFull report on our scorecard.\nNot financial advice.",
      { ...input, siteLabel: "asklens.xyz", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
    );
    expect(enforced.ok).toBe(true);
    if (enforced.ok) {
      expect(enforced.text).toContain("Full report on asklens.xyz.");
      expect(enforced.text).toContain(shortMint("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"));
      expect(enforced.text).not.toMatch(/dexscreener\.com/);
      expect(enforced.text).not.toContain("our scorecard");
    }
  });

  it("drops unknown facts from the reply and keeps the short mint", () => {
    const text = buildTemplateReply({
      ...input,
      symbol: "BONK",
      riskLevel: "LOW",
      mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      facts: [
        {
          id: "creator_wallet",
          signal: "unknown",
          text: "Creator wallet activity could not be verified.",
          short: "Creator sells could not be verified.",
          sourceUrl: null,
          sourceLabel: null,
        },
        {
          id: "mint_authority",
          signal: "good",
          text: "Mint authority is turned off.",
          short: "Mint authority is off.",
          sourceUrl: null,
          sourceLabel: null,
        },
        {
          id: "incomplete",
          signal: "unknown",
          text: "Several checks could not be verified, so this is not a clear pass.",
          short: "Several checks could not be verified.",
          sourceUrl: null,
          sourceLabel: null,
        },
      ],
    });
    expect(text).toContain("$BONK (DezX…B263): LOW risk.");
    expect(text).toContain("Mint authority is off.");
    expect(text).toContain("Several checks could not be verified.");
    expect(text).not.toContain("Creator sells could not be verified");
    expect(text).not.toContain("Full report");
    expect(text.length).toBeLessThanOrEqual(280);
    expect(text.endsWith("Not financial advice.")).toBe(true);
  });

  it("keeps exactly one blink URL when a swap link is requested", () => {
    const swapUrl =
      "https://asklens.com/trade/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
    const draft = {
      ...input,
      riskLevel: "LOW" as const,
      symbol: "BONK",
      mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      siteLabel: "Lens",
      swapUrl,
    };
    const text = buildTemplateReply(draft);
    expect(text.match(/https?:\/\/\S+/g)).toEqual([swapUrl]);
    expect(text).toContain("Full report on Lens.");
    expect(text).toContain("$BONK (DezX…B263): LOW risk.");
    expect(text.endsWith("Not financial advice.")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(500);

    const repaired = enforceReplyPolicy(
      `LOW risk. See https://evil.example/phish and https://asklens.com/r/abc\nNot financial advice.`,
      draft,
    );
    expect(repaired.ok).toBe(true);
    if (!repaired.ok) return;
    expect(repaired.text.match(/https?:\/\/\S+/g)).toEqual([swapUrl]);
    expect(repaired.text).not.toContain("evil.example");
    expect(repaired.text).not.toContain("/r/abc");
    expect(repaired.text.endsWith("Not financial advice.")).toBe(true);
  });

  it("keeps ticker notices inside the wording rules", () => {
    const notices = [
      ambiguousTickerReply("JUP"),
      foreignTickerReply("XRP"),
      nativeSolReply(),
      stableTickerReply("USDC", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      wrappedMajorReply("WBTC"),
    ];
    for (const text of notices) {
      expect(() => assertSafeNotice(text)).not.toThrow();
      expect(text).not.toMatch(/\b(LOW|MEDIUM|HIGH)\b/);
      expect(text).not.toMatch(/https?:\/\//);
      expect(text.endsWith("Not financial advice.")).toBe(true);
    }
    expect(stableTickerReply("USDC", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toContain("EPjF…Dt1v");
  });

  it("keeps the unresolved notice inside the wording rules", () => {
    expect(() => assertSafeNotice(UNRESOLVED_REPLY)).not.toThrow();
    expect(UNRESOLVED_REPLY.endsWith("Not financial advice.")).toBe(true);
  });

  it("does not let rule facts use the word scam", () => {
    const report = evaluateRisk({
      coinAgeHours: 1,
      liquidityUsd: 100,
      lpLocked: false,
      top10HolderPct: 90,
      creatorSoldPct: 60,
      creatorBalancePct: 1,
      mintAuthorityActive: true,
      freezeAuthorityActive: true,
      sniperPct: 50,
      burnedPct: 0,
      claims: { burned: true, locked: true },
    } satisfies RuleInput);
    expect(report.facts.map((fact) => fact.text).join("\n")).not.toMatch(/scam/i);
  });
});
