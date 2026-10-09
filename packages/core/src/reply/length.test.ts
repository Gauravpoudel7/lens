import { describe, expect, it } from "vitest";
import { containsUrl, fitsX, xWeightedLength } from "./length.js";

describe("X weighted length", () => {
  it("counts emoji, bullets, and CJK as 2 where text.length says 1", () => {
    for (const text of ["✅", "•", "…", "中"]) {
      expect(text.length).toBe(1);
      expect(xWeightedLength(text)).toBe(2);
    }
  });

  it("counts an emoji sequence as 2 however many code units it has", () => {
    expect(xWeightedLength("🛡️")).toBe(2);
    expect(xWeightedLength("👨‍👩‍👧")).toBe(2);
    expect(xWeightedLength("🇺🇸")).toBe(2);
    expect(xWeightedLength("Plain text — ok × 2")).toBe("Plain text — ok × 2".length);
  });

  it("counts any URL, including a bare domain, as 23", () => {
    expect(xWeightedLength("https://example.com/very/long/path")).toBe(23);
    expect(xWeightedLength("hello x.com/foo")).toBe(29);
    expect(xWeightedLength("pump.fun is")).toBe(26);
  });

  it("rejects a text whose emoji push it past 280 although text.length fits", () => {
    const text = "✅".repeat(141);
    expect(text.length).toBeLessThanOrEqual(280);
    expect(fitsX(text)).toBe(false);
  });

  it("finds http, www., and bare domains", () => {
    expect(containsUrl("see https://a.b")).toBe(true);
    expect(containsUrl("www.example")).toBe(true);
    expect(containsUrl("go to lens.xyz now")).toBe(true);
    expect(containsUrl("x.com/justasklens")).toBe(true);
    expect(containsUrl("Price × number of coins. Not financial advice.")).toBe(false);
    expect(containsUrl("e.g. a 3.5x move")).toBe(false);
  });
});
