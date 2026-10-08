import { afterEach, describe, expect, it, vi } from "vitest";
import { isBusyError, rpcCall } from "./rpc.js";

const noSleep = async () => {};

afterEach(() => {
  vi.unstubAllGlobals();
});

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("rpcCall", () => {
  it("retries HTTP 429 and a JSON-RPC 429, then returns the result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(429, {}))
      .mockResolvedValueOnce(reply(200, { error: { code: 429, message: "Too many requests" } }))
      .mockResolvedValueOnce(reply(200, { result: { value: 7 } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(rpcCall("https://rpc.example", "getBalance", ["x"], { attempts: 4, sleep: noSleep })).resolves.toEqual({
      value: 7,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a plain RPC error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { error: { code: -32602, message: "Invalid param" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(rpcCall("https://rpc.example", "getBalance", ["x"], { attempts: 4, sleep: noSleep })).rejects.toThrow(
      "Invalid param",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("marks rate limits and outages as busy", () => {
    expect(isBusyError(new Error("RPC HTTP 429 getBalance"))).toBe(true);
    expect(isBusyError(new Error("fetch failed"))).toBe(true);
    expect(isBusyError(new Error("Invalid param"))).toBe(false);
  });
});
