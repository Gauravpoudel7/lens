import { describe, expect, it } from "vitest";
import { evaluateRisk, type RuleInput } from "../risk/engine.js";
import {
  buildTemplateReply,
  enforceReplyPolicy,
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
  it("builds a template that states the level, links the report, and ends with the disclaimer", () => {
    const text = buildTemplateReply(input);
    expect(text).toContain("HIGH");
    expect(text).toContain(input.reportUrl);
    expect(text.endsWith("Not financial advice.")).toBe(true);
    expect(text).not.toMatch(/scam/i);
    expect(text.length).toBeLessThanOrEqual(280);
  });

  it("strips accusations and rejects a reply that changes the risk level", () => {
    const cleaned = enforceReplyPolicy(
      "This scam is HIGH risk. Report: http://127.0.0.1:3847/r/abc",
      input,
    );
    expect(cleaned.ok).toBe(true);
    if (cleaned.ok) {
      expect(cleaned.text).not.toMatch(/scam/i);
      expect(cleaned.text.endsWith("Not financial advice.")).toBe(true);
    }
    const conflicted = enforceReplyPolicy("Actually this is LOW risk.\nNot financial advice.", input);
    expect(conflicted.ok).toBe(false);
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
