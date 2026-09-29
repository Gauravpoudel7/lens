import { describe, expect, it } from "vitest";
import { isRetryable, withRetry } from "./retry.js";

describe("withRetry", () => {
  it("retries HTTP 429 and then returns the value", async () => {
    let calls = 0;
    const value = await withRetry(
      "rpc",
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("RPC HTTP 429 getTokenLargestAccounts");
        return "ok";
      },
      { attempts: 4, baseMs: 1, sleep: async () => undefined },
    );
    expect(value).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry a normal failure", async () => {
    let calls = 0;
    await expect(
      withRetry(
        "rpc",
        async () => {
          calls += 1;
          throw new Error("invalid mint");
        },
        { attempts: 4, baseMs: 1, sleep: async () => undefined },
      ),
    ).rejects.toThrow("invalid mint");
    expect(calls).toBe(1);
    expect(isRetryable(new Error("invalid mint"))).toBe(false);
  });
});
