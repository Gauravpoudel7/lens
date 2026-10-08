import { Connection } from "@solana/web3.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSolanaProofPublisher } from "./solana.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("solana proof publisher", () => {
  it("reads a confirmed memo once and serves repeats from memory", async () => {
    const tx = {
      blockTime: 1_700_000_000,
      meta: { logMessages: ['Program log: Memo (len 9): "lens:v2|x"'] },
      transaction: { message: { header: { numRequiredSignatures: 1 }, staticAccountKeys: ["Signer111"], compiledInstructions: [] } },
    };
    const spy = vi.spyOn(Connection.prototype, "getTransaction").mockResolvedValue(tx as never);
    const publisher = createSolanaProofPublisher({ solanaRpcUrl: "https://rpc.example", solanaCluster: "devnet" });
    const first = await publisher.readMemo("sig-1");
    const second = await publisher.readMemo("sig-1");
    expect(second).toEqual(first);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("retries a rate-limited read", async () => {
    const spy = vi
      .spyOn(Connection.prototype, "getTransaction")
      .mockRejectedValueOnce(new Error("429 Too Many Requests"))
      .mockResolvedValue(null);
    const publisher = createSolanaProofPublisher({
      solanaRpcUrl: "https://rpc.example",
      solanaCluster: "devnet",
      rpcRetryAttempts: 2,
    });
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 200 });
    const memo = await publisher.readMemo("sig-2");
    vi.useRealTimers();
    expect(memo.payload).toBeNull();
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
