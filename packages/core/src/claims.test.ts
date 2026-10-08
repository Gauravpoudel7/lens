import { describe, expect, it } from "vitest";
import { claimsFromPosts, extractClaims } from "./claims.js";

describe("claim extraction", () => {
  it("reads burned and locked claims from a promo", () => {
    expect(extractClaims("LP locked and burned. 100x soon")).toEqual({
      burned: true,
      locked: true,
    });
  });

  it("ignores questions and negated claims", () => {
    expect(extractClaims("@justasklens is the LP locked?")).toEqual({ burned: false, locked: false });
    expect(extractClaims("Liquidity is not locked. Supply was never burned.")).toEqual({
      burned: false,
      locked: false,
    });
  });

  it("uses the parent post, not the question under it", () => {
    expect(claimsFromPosts("Dev says LP locked and burned", "@justasklens is this legit?")).toEqual({
      burned: true,
      locked: true,
    });
  });
});
