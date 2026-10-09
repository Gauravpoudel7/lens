import { describe, expect, it } from "vitest";
import { xWeightedLength } from "../reply/length.js";
import { buildActivityRecap, buildMarketRecap } from "./recap.js";
import { checkFixture, snapshotFixture } from "./testing.js";

const A = "AaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaA1";
const B = "BbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbB2";
const C = "CcccccccccccccccccccccccccccccccccccccccccC3";
const D = "DdddddddddddddddddddddddddddddddddddddddddD4";

describe("activity recap", () => {
  it("is null under 3 coins", () => {
    expect(buildActivityRecap([checkFixture("1", A), checkFixture("2", B), checkFixture("3", B)], "devnet")).toBeNull();
  });

  it("counts coins once, omits zero levels, names the most asked, and shows the real cluster", () => {
    const text = buildActivityRecap(
      [
        checkFixture("1", A, { tokenSymbol: "BONK", riskLevel: "LOW" }),
        checkFixture("2", A, { tokenSymbol: "BONK", riskLevel: "LOW" }),
        checkFixture("3", B, { riskLevel: "HIGH" }),
        checkFixture("4", C, { riskLevel: "HIGH" }),
      ],
      "devnet",
    );
    expect(text).toBe(
      [
        "📊 Lens today",
        "• 3 coins checked",
        "• 2 HIGH · 1 LOW",
        "• Most asked: $BONK",
        "• Every answer has an on-chain proof (Solana devnet)",
        "Not financial advice.",
      ].join("\n"),
    );
    expect(xWeightedLength(text!)).toBeLessThanOrEqual(280);
  });

  it("leaves out mock, unresolved, notice, hidden, and pre-fix checks", () => {
    const text = buildActivityRecap(
      [
        checkFixture("1", A),
        checkFixture("2", B),
        checkFixture("3", C, { dataMode: "mock" }),
        checkFixture("4", C, { kind: "unresolved" }),
        checkFixture("5", C, { riskLevel: "NONE" }),
        checkFixture("6", C, { status: "hidden" }),
        checkFixture("7", C, { dataVersion: 1 }),
        checkFixture("8", D, { kind: "blink" }),
      ],
      "devnet",
    );
    expect(text).toBeNull();
  });

  it("omits the most-asked line on a tie and the proof line when a proof is not confirmed on that cluster", () => {
    const text = buildActivityRecap(
      [checkFixture("1", A), checkFixture("2", B), checkFixture("3", C, { proof: { ...checkFixture("x", C).proof!, cluster: "mock", status: "mocked" } })],
      "devnet",
    )!;
    expect(text).not.toContain("Most asked");
    expect(text).not.toContain("on-chain proof");
    expect(buildActivityRecap([checkFixture("1", A), checkFixture("2", B), checkFixture("3", C)], "mainnet-beta")).not.toContain(
      "on-chain proof",
    );
  });
});

describe("market recap", () => {
  const now = new Date("2026-10-09T17:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

  it("leads with risk, writes tickers without $, and has no prices or %", () => {
    const text = buildMarketRecap(
      [
        snapshotFixture(A, { symbol: "$WIF", mintAuthorityActive: true, createdAt: hoursAgo(9) }),
        snapshotFixture(B, { symbol: "FROG", mintAuthorityActive: true, freezeAuthorityActive: true, createdAt: hoursAgo(20) }),
        snapshotFixture(C, { symbol: "OLD", createdAt: hoursAgo(24 * 40) }),
        snapshotFixture(D, { symbol: "NEW", createdAt: hoursAgo(2), liquidityUsd: null }),
        null,
      ],
      now,
    );
    expect(text).toBe(
      [
        "📊 Trending on Solana today, Lens checked 3",
        "• 2 can still mint new coins",
        "• 1 has freeze on",
        "• 2 are under 1 day old",
        "• Newest: WIF (9 hours old)",
        "Not financial advice.",
      ].join("\n"),
    );
    expect(text).not.toMatch(/\$[A-Za-z]/);
    expect(text).not.toContain("%");
  });

  it("omits zero-count lines", () => {
    const text = buildMarketRecap([snapshotFixture(A), snapshotFixture(B), snapshotFixture(C)], now)!;
    expect(text).toBe(["📊 Trending on Solana today, Lens checked 3", "Not financial advice."].join("\n"));
  });

  it("skips when fewer than 3 coins pass the gate", () => {
    expect(buildMarketRecap([snapshotFixture(A), snapshotFixture(B), snapshotFixture(C, { liquidityUsd: null }), null], now)).toBeNull();
  });
});
