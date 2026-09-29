import { describe, expect, it } from "vitest";
import { evaluateRisk, snapshotToRuleInput, type RuleInput } from "./engine.js";
import { FIXTURES, materializeFixture } from "../providers/mock.js";
import { STAKE_POOL_MINTS, STAKE_POOL_PROGRAMS } from "./stake-pools.js";

const noClaims = { burned: false, locked: false };

function base(overrides: Partial<RuleInput> = {}): RuleInput {
  return {
    coinAgeHours: 24 * 120,
    liquidityUsd: 250_000,
    lpLocked: true,
    top10HolderPct: 25,
    creatorSoldPct: 0,
    creatorBalancePct: 4,
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
    sniperPct: 3,
    burnedPct: 0,
    claims: noClaims,
    ...overrides,
  };
}

describe("risk rules", () => {
  it("scores a clean token LOW", () => {
    const report = evaluateRisk(base());
    expect(report.level).toBe("LOW");
    expect(report.dangerCount).toBe(0);
    expect(report.facts.map((fact) => fact.text).join(" ")).not.toMatch(/scam/i);
  });

  it("treats one danger sign as MEDIUM", () => {
    const report = evaluateRisk(base({ mintAuthorityActive: true }));
    expect(report.level).toBe("MEDIUM");
    expect(report.facts.find((fact) => fact.id === "mint_authority")?.signal).toBe("danger");
  });

  it("does not treat a known stake-pool mint authority as danger", () => {
    const [jitoMint] = Object.keys(STAKE_POOL_MINTS);
    const report = evaluateRisk(base({ mint: jitoMint, mintAuthorityActive: true }));
    expect(report.level).toBe("LOW");
    expect(report.dangerCount).toBe(0);
    const fact = report.facts.find((item) => item.id === "mint_authority");
    expect(fact?.signal).toBe("good");
    expect(fact?.short.toLowerCase()).toContain("stake-pool token");
    expect(fact?.text.toLowerCase()).toContain("stake-pool token");
  });

  it("treats mint authority held by a stake-pool program as a stake-pool token", () => {
    const [program] = STAKE_POOL_PROGRAMS;
    const report = evaluateRisk(
      base({
        mint: "NotAListedMint111111111111111111111111111",
        mintAuthority: program,
        mintAuthorityActive: true,
      }),
    );
    expect(report.level).toBe("LOW");
    expect(report.facts.find((fact) => fact.id === "mint_authority")?.short.toLowerCase()).toContain(
      "stake-pool token",
    );
  });

  it("still flags mint authority on a token that only copies a stake-pool ticker", () => {
    const report = evaluateRisk(
      base({
        mint: "FakeJitoMint11111111111111111111111111111",
        mintAuthorityActive: true,
      }),
    );
    expect(report.level).toBe("MEDIUM");
    expect(report.facts.find((fact) => fact.id === "mint_authority")?.signal).toBe("danger");
  });

  it("treats mint and freeze authority together as HIGH", () => {
    const report = evaluateRisk(base({ mintAuthorityActive: true, freezeAuthorityActive: true }));
    expect(report.level).toBe("HIGH");
    expect(report.dangerCount).toBe(2);
  });

  it("flags a new, thin, concentrated token as HIGH", () => {
    const report = evaluateRisk(
      base({
        coinAgeHours: 2,
        liquidityUsd: 1_500,
        lpLocked: false,
        top10HolderPct: 81,
        sniperPct: 40,
      }),
    );
    expect(report.level).toBe("HIGH");
    expect(report.dangerCount).toBeGreaterThanOrEqual(2);
  });

  it("does not call a single caution HIGH or MEDIUM", () => {
    const report = evaluateRisk(base({ liquidityUsd: 80_000, lpLocked: false }));
    expect(report.level).toBe("LOW");
    expect(report.cautionCount).toBe(1);
  });

  it("treats two cautions as MEDIUM", () => {
    const report = evaluateRisk(
      base({
        coinAgeHours: 24 * 3,
        top10HolderPct: 55,
      }),
    );
    expect(report.level).toBe("MEDIUM");
  });

  it("flags a burned claim that the chain does not support", () => {
    const report = evaluateRisk(
      base({
        claims: { burned: true, locked: false },
        burnedPct: 0,
      }),
    );
    expect(report.level).toBe("MEDIUM");
    expect(report.facts.find((fact) => fact.id === "claims")?.signal).toBe("danger");
  });

  it("raises a false lock claim plus another danger to HIGH", () => {
    const report = evaluateRisk(
      base({
        claims: { burned: false, locked: true },
        lpLocked: false,
        mintAuthorityActive: true,
        liquidityUsd: 80_000,
      }),
    );
    expect(report.level).toBe("HIGH");
  });

  it("accepts a burn claim when the chain shows a real burn", () => {
    const report = evaluateRisk(
      base({
        claims: { burned: true, locked: false },
        burnedPct: 40,
      }),
    );
    expect(report.facts.find((fact) => fact.id === "claims")?.signal).toBe("good");
    expect(report.level).toBe("LOW");
  });

  it("does not award LOW when most checks are unknown", () => {
    const report = evaluateRisk(
      base({
        coinAgeHours: null,
        liquidityUsd: null,
        lpLocked: null,
        top10HolderPct: null,
        creatorSoldPct: null,
        creatorBalancePct: null,
        mintAuthorityActive: null,
        freezeAuthorityActive: null,
        sniperPct: null,
        burnedPct: null,
      }),
    );
    expect(report.level).toBe("MEDIUM");
    expect(report.incomplete).toBe(true);
    expect(report.facts.some((fact) => fact.id === "incomplete")).toBe(true);
  });

  it("keeps creator sells unknown when only a balance is known", () => {
    const report = evaluateRisk(base({ creatorSoldPct: null, creatorBalancePct: 12 }));
    expect(report.facts.find((fact) => fact.id === "creator_wallet")?.signal).toBe("unknown");
    expect(report.level).toBe("LOW");
  });

  it("matches the mock fixtures", () => {
    const now = new Date("2026-09-29T12:00:00.000Z");
    const danger = evaluateRisk(
      snapshotToRuleInput(materializeFixture(FIXTURES.danger, now), { burned: true, locked: true }, now),
      materializeFixture(FIXTURES.danger, now).links,
    );
    const safe = evaluateRisk(
      snapshotToRuleInput(materializeFixture(FIXTURES.safe, now), noClaims, now),
    );
    const mid = evaluateRisk(
      snapshotToRuleInput(materializeFixture(FIXTURES.mid, now), noClaims, now),
    );
    expect(danger.level).toBe("HIGH");
    expect(safe.level).toBe("LOW");
    expect(mid.level).toBe("MEDIUM");
    expect(danger.facts.every((fact) => fact.sourceUrl)).toBe(true);
  });
});
