import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { parseDexCandidateFeed } from "./discover.js";
import { FIXTURES, MockTokenDataProvider } from "./providers/mock.js";
import { runOutboundCycle, type LensDeps } from "./pipeline.js";
import { createMockProofPublisher } from "./proof/mock.js";
import { createReplyWriter } from "./reply/writer.js";
import { MemoryStore } from "./store/memory.js";
import { MockXClient } from "./x/mock.js";

describe("discovery", () => {
  it("keeps Solana mints from a DexScreener feed", () => {
    const rows = parseDexCandidateFeed([
      { chainId: "solana", tokenAddress: FIXTURES.danger.mint },
      { chainId: "ethereum", tokenAddress: FIXTURES.safe.mint },
      { chainId: "solana", tokenAddress: "not-a-mint" },
      { chainId: "solana", tokenAddress: FIXTURES.danger.mint },
    ]);
    expect(rows.map((row) => row.mint)).toEqual([FIXTURES.danger.mint]);
  });

  it("posts calls and warnings up to the daily cap and skips medium", async () => {
    const store = new MemoryStore();
    const x = new MockXClient();
    const config = loadConfig({
      DATA_MODE: "mock",
      PROOF_MODE: "mock",
      LLM_MODE: "template",
      PUBLIC_BASE_URL: "http://127.0.0.1:3847",
      OUTBOUND_ENABLED: "true",
      OUTBOUND_DAILY_CAP: "1",
    });
    const deps: LensDeps = {
      config,
      store,
      provider: new MockTokenDataProvider(),
      proofs: createMockProofPublisher(store),
      writer: createReplyWriter(config),
      x,
    };
    const result = await runOutboundCycle(deps, {
      now: new Date("2026-09-29T12:00:00.000Z"),
      discover: true,
      candidates: [
        { mint: FIXTURES.mid.mint, symbol: "MID" },
        { mint: FIXTURES.danger.mint, symbol: "DANGER" },
        { mint: FIXTURES.safe.mint, symbol: "SAFE" },
      ],
    });
    expect(result.posted).toBe(1);
    expect(x.timeline).toHaveLength(1);
    const checks = await store.listChecks();
    expect(checks).toHaveLength(1);
    expect(checks[0]?.kind).toBe("warning");
    expect(checks[0]?.riskLevel).toBe("HIGH");
    expect(await store.getOutboundCount("2026-09-29")).toBe(1);
  });
});