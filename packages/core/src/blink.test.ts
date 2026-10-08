import { describe, expect, it } from "vitest";
import {
  ACTION_CORS_HEADERS,
  ACTION_RESPONSE_HEADERS,
  ACTIONS_JSON,
  ACTIONS_JSON_HEADERS,
  buildBlinkAction,
} from "./blink.js";
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
    expect(action.type).toBe("action");
    expect(action.disabled).toBeUndefined();
    expect(action.icon).toBe("http://127.0.0.1:3847/mark.png");
    expect(action.links?.actions.some((item) => item.href.includes("amount=0.1"))).toBe(true);
    const custom = action.links?.actions.find((item) => item.href.includes("{amount}"));
    expect(custom?.type).toBe("transaction");
    expect(custom?.parameters?.[0]).toMatchObject({ name: "amount", type: "number", min: 0.000001, max: 50 });
    expect(action.description).toContain("MEDIUM");
    const buys = action.links?.actions.filter((item) => item.type === "transaction") ?? [];
    expect(buys.length).toBeGreaterThan(0);
    for (const buy of buys) expect(buy.label.split(/\s+/).length).toBeLessThanOrEqual(5);
  });

  it("publishes an idempotent actions.json rule and the CORS headers the spec requires", () => {
    expect(ACTIONS_JSON.rules).toEqual([
      { pathPattern: "/trade/*", apiPath: "/api/actions/trade/*" },
      { pathPattern: "/api/actions/**", apiPath: "/api/actions/**" },
    ]);
    expect(ACTION_CORS_HEADERS["Access-Control-Allow-Origin"]).toBe("*");
    expect(ACTION_CORS_HEADERS["Access-Control-Allow-Methods"]).toBe("GET,POST,PUT,OPTIONS");
    expect(ACTION_CORS_HEADERS["Access-Control-Allow-Headers"]).toContain("Content-Type");
    expect(ACTION_CORS_HEADERS["Access-Control-Allow-Headers"]).toContain("Authorization");
    expect(ACTION_CORS_HEADERS["Access-Control-Allow-Headers"]).toContain("Content-Encoding");
    expect(ACTION_CORS_HEADERS["Access-Control-Allow-Headers"]).toContain("Accept-Encoding");
    expect(ACTION_CORS_HEADERS["Access-Control-Expose-Headers"]).toContain("X-Action-Version");
    expect(ACTIONS_JSON_HEADERS["Access-Control-Allow-Origin"]).toBe("*");
    expect(ACTIONS_JSON_HEADERS["Content-Type"]).toBe("application/json");
    expect(ACTION_RESPONSE_HEADERS["Content-Type"]).toBe("application/json");
    expect(ACTION_RESPONSE_HEADERS["X-Action-Version"]).toBe("2.4");
    expect(ACTION_RESPONSE_HEADERS["X-Blockchain-Ids"]).toContain("solana:");
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
