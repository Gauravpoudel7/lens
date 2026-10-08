import { describe, expect, it, vi, beforeEach } from "vitest";
import { SESSION_COOKIE, loadConfig, signSession } from "@lens/core";
import { MemoryStore } from "../../../../../packages/core/src/store/memory.js";

const wallet = "6bzZwnSvBLur1xr9baRyHZ3Ck4GgiUCUZf8YQ3oXBEm5";
const config = loadConfig({ NODE_ENV: "test", LENS_SESSION_SECRET: "test-secret" });
const store = new MemoryStore();
const jar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("@/lib/runtime", () => ({ getRuntime: async () => ({ config, store }) }));

const { GET } = await import("./account/route");
const watch = await import("./watch/route");

const mint = "So11111111111111111111111111111111111111112";
const site = { host: "127.0.0.1:3847", origin: "http://127.0.0.1:3847", "content-type": "application/json" };

beforeEach(async () => {
  jar.clear();
  const user = await store.upsertUser({ wallet });
  await store.setProUntil(user.id, new Date(Date.now() + 86_400_000).toISOString());
});

describe("account and watchlist need the wallet session cookie", () => {
  it("shows only Pro yes/no to a lookup without the cookie", async () => {
    const response = await GET(new Request(`http://127.0.0.1:3847/api/pro/account?wallet=${wallet}`));
    const body = (await response.json()) as { user: unknown; restricted: boolean; public: { pro: boolean }; linkCode: unknown };
    expect(body.user).toBeNull();
    expect(body.restricted).toBe(true);
    expect(body.public.pro).toBe(true);
    expect(body.linkCode).toBeNull();
  });

  it("shows the plan and link code to the signed-in wallet", async () => {
    jar.set(SESSION_COOKIE, signSession(wallet, "test-secret").token);
    const response = await GET(new Request("http://127.0.0.1:3847/api/pro/account"));
    const body = (await response.json()) as { user: { wallet: string }; linkCode: { code: string } | null };
    expect(body.user.wallet).toBe(wallet);
    expect(body.linkCode?.code).toMatch(/^LENS-/);
  });

  it("ignores a cookie signed with another secret", async () => {
    jar.set(SESSION_COOKIE, signSession(wallet, "other-secret").token);
    const response = await GET(new Request("http://127.0.0.1:3847/api/pro/account"));
    expect(response.status).toBe(400);
  });

  it("refuses watchlist writes without the cookie or from another site", async () => {
    const body = JSON.stringify({ mint });
    const noCookie = await watch.POST(new Request("http://127.0.0.1:3847/api/pro/watch", { method: "POST", headers: site, body }));
    expect(noCookie.status).toBe(401);
    jar.set(SESSION_COOKIE, signSession(wallet, "test-secret").token);
    const crossSite = await watch.POST(
      new Request("http://127.0.0.1:3847/api/pro/watch", {
        method: "POST",
        headers: { ...site, origin: "https://evil.example" },
        body,
      }),
    );
    expect(crossSite.status).toBe(403);
    const ok = await watch.POST(new Request("http://127.0.0.1:3847/api/pro/watch", { method: "POST", headers: site, body }));
    expect(ok.status).toBe(200);
    const removed = await watch.DELETE(
      new Request("http://127.0.0.1:3847/api/pro/watch", { method: "DELETE", headers: site, body }),
    );
    expect(((await removed.json()) as { watches: unknown[] }).watches).toHaveLength(0);
  });
});
