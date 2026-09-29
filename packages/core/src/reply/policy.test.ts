import { describe, expect, it } from "vitest";
import { evaluateRisk, type RuleInput } from "../risk/engine.js";
import {
  buildTemplateReply,
  enforceReplyPolicy,
  SCORECARD_LINE,
  stripReplyUrls,
  UNRESOLVED_REPLY,
  assertSafeNotice,
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
    expect(text).toContain(SCORECARD_LINE);
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
      expect(cleaned.text).toContain(SCORECARD_LINE);
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
      expect(enforced.text).toContain(SCORECARD_LINE);
      expect(enforced.text.endsWith("Not financial advice.")).toBe(true);
    }
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
