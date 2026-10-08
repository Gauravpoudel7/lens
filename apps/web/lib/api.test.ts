import { describe, expect, it, vi } from "vitest";
import { BROKEN_MESSAGE, BUSY_MESSAGE, route } from "./api";

describe("route", () => {
  it("hides raw errors and logs them without query strings", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = route("test", async () => {
      throw new Error("ENOENT: no such file, open 'https://rpc.example/?api-key=secret'");
    });
    const response = await handler();
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe(BROKEN_MESSAGE);
    const logged = spy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("ENOENT");
    expect(logged).not.toContain("secret");
    spy.mockRestore();
  });

  it("says the network is busy on a 429", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await route("test", async () => {
      throw new Error("RPC HTTP 429 getBalance");
    })();
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: string }).error).toBe(BUSY_MESSAGE);
    spy.mockRestore();
  });
});
