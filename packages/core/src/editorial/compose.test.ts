import { describe, expect, it } from "vitest";
import { containsUrl, xWeightedLength } from "../reply/length.js";
import { assertEditorialText, composeTerm, composeTip } from "./compose.js";
import { TERMS, TIPS } from "./content.js";

describe("editorial compose", () => {
  it("has 15 tips and 14 terms", () => {
    expect(TIPS).toHaveLength(15);
    expect(TERMS).toHaveLength(14);
  });

  it("composes every tip and term within 280 weighted characters, with no URL, scam, or hashtag", () => {
    const all = [...TIPS.map((_, i) => composeTip(i)), ...TERMS.map((_, i) => composeTerm(i))];
    for (const text of all) {
      expect(xWeightedLength(text)).toBeLessThanOrEqual(280);
      expect(containsUrl(text)).toBe(false);
      expect(text).not.toMatch(/scam/i);
      expect(text).not.toMatch(/#\w/);
    }
    expect(composeTip(0).startsWith("🛡️ Safety tip\n\n")).toBe(true);
    expect(composeTerm(0).startsWith("📘 Rug pull:")).toBe(true);
  });

  it("wraps the rotation", () => {
    expect(composeTip(15)).toBe(composeTip(0));
    expect(composeTerm(-1)).toBe(composeTerm(13));
  });

  it("rejects a URL, a bare domain, a hashtag, scam, and an over-long text", () => {
    expect(() => assertEditorialText("see pump.fun")).toThrow(/URL/);
    expect(() => assertEditorialText("go https://x.com")).toThrow(/URL/);
    expect(() => assertEditorialText("hello #solana")).toThrow(/hashtag/);
    expect(() => assertEditorialText("not a scam")).toThrow(/wording/);
    expect(() => assertEditorialText("✅".repeat(141))).toThrow(/280/);
  });
});
