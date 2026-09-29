import { describe, expect, it } from "vitest";
import { buildBlinkAction } from "./blink.js";
import type { CheckRecord } from "./types.js";

const config = { publicBaseUrl: "http://127.0.0.1:3847" };

describe("blink action", () => {
  it("shows a warning instead of a buy for HIGH risk", () => {
    const action = buildBlinkAction(check("HIGH"), config);
    expect(action.disabled).toBe(true);
    expect(action.label).toBe("High risk");
    expect(action.description).not.toMatch(/scam/i);
    expect(action.description).toContain("Not financial advice.");
    const buys = action.links?.actions.filter((item) => item.type === "transaction") ?? [];
    expect(buys).toHaveLength(0);
  });

  it("offers Jupiter buy actions for a token that is not HIGH", () => {
    const action = buildBlinkAction(check("MEDIUM"), config);
    expect(action.disabled).toBeUndefined();
    expect(action.links?.actions.some((item) => item.href.includes("amount=0.1"))).toBe(true);
    expect(action.description).toContain("MEDIUM");
  });
});

function check(level: "HIGH" | "MEDIUM"): CheckRecord {
  return {
    id: "report1",
    kind: "blink",
    mentionId: null,
    parentPostId: null,
    tokenMint: "Mint111111111111111111111111111111111111",
    tokenSymbol: "DEMO",
    tokenName: "Demo",
    riskLevel: level,
    score: 0,
    dangerCount: level === "HIGH" ? 2 : 0,
    cautionCount: 0,
    unknownCount: 0,
    facts: [
      {
        id: "mint_authority",
        signal: "danger",
        text: "Mint authority is still on, so more tokens can be created.",
        short: "Mint authority is still on.",
        sourceUrl: null,
        sourceLabel: null,
      },
    ],
    snapshot: null,
    claims: { burned: false, locked: false },
    sources: ["mock"],
    dataMode: "mock",
    replyText: "Not financial advice.",
    sourcePostText: null,
    priceAtCheck: 1,
    askedBy: null,
    status: "published",
    error: null,
    xPostId: null,
    createdAt: "2026-09-29T00:00:00.000Z",
    proof: null,
    outcome: null,
  };
}
