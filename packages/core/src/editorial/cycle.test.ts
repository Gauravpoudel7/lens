import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config.js";
import type { LensDeps } from "../pipeline.js";
import { hashReply } from "../proof/hash.js";
import { createMockProofPublisher } from "../proof/mock.js";
import { MockTokenDataProvider } from "../providers/mock.js";
import type { TokenDataProvider } from "../providers/types.js";
import { createReplyWriter } from "../reply/writer.js";
import { MemoryStore } from "../store/memory.js";
import { MockXClient } from "../x/mock.js";
import { composeTerm, composeTip } from "./compose.js";
import { runEditorialCycle } from "./cycle.js";
import { checkFixture, snapshotFixture } from "./testing.js";

const AT_TIP = new Date("2026-10-09T13:05:00Z");
const AT_RECAP = new Date("2026-10-09T17:05:00Z");

function setup(env: Record<string, string> = {}, provider: TokenDataProvider = new MockTokenDataProvider()) {
  const store = new MemoryStore();
  const x = new MockXClient();
  const config = loadConfig({
    DATA_MODE: "live",
    PROOF_MODE: "mock",
    X_MODE: "live",
    LLM_MODE: "template",
    EDITORIAL_ENABLED: "true",
    ...env,
  });
  const proofs = createMockProofPublisher(store);
  const deps: LensDeps = { config, store, provider, proofs, writer: createReplyWriter(config), x };
  return { deps, store, x, proofs };
}

function liveProvider(): TokenDataProvider {
  return {
    name: "live",
    async resolveBySymbol() {
      return { status: "none" };
    },
    async getToken(mint) {
      return snapshotFixture(mint, { symbol: mint.slice(0, 4), mintAuthorityActive: true });
    },
    async getPrice() {
      return null;
    },
  };
}

function trendingFetch(): typeof fetch {
  const mints = [
    "HbPDWSqu8hpVMX6gMjwMDGe5rVgicWo3Qh3Jaojypump",
    "GTBxUiw6wJdmmkCGZgRHLyYxqu1vG4KtRpeox6yDpump",
    "64oAuE88tNP7KsSyaiJTKGP4sWmLMFGWLUs9eBTLYgCp",
  ];
  const body = {
    data: mints.map((mint) => ({ relationships: { base_token: { data: { id: `solana_${mint}` } } } })),
    included: mints.map((mint) => ({ id: `solana_${mint}`, attributes: { address: mint, symbol: mint.slice(0, 4) } })),
  };
  return vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
}

afterEach(() => vi.restoreAllMocks());

describe("editorial cycle", () => {
  it("does nothing when EDITORIAL_ENABLED is false", async () => {
    const { deps, x } = setup({ EDITORIAL_ENABLED: "false" });
    expect(await runEditorialCycle(deps, AT_TIP)).toBeNull();
    expect(x.timeline).toHaveLength(0);
  });

  it("proves the exact text, then posts it, then advances the tip rotation", async () => {
    const { deps, store, x } = setup();
    const result = await runEditorialCycle(deps, AT_TIP);
    expect(result).toMatchObject({ kind: "tip", status: "posted" });
    const record = await store.getEditorial("tip", "2026-10-09");
    expect(record?.text).toBe(composeTip(0));
    expect(record?.payload).toContain(hashReply(composeTip(0)));
    expect((await store.getChainMemo(record!.txSignature!))?.payload).toBe(record?.payload);
    expect(x.timeline.map((post) => post.text)).toEqual([composeTip(0)]);
    expect(await store.getCursor("editorial_tip_index")).toBe("1");
    expect(await runEditorialCycle(deps, new Date("2026-10-09T13:08:00Z"))).toBeNull();
    expect(x.timeline).toHaveLength(1);
  });

  it("posts one kind per poll", async () => {
    const { deps, x } = setup();
    expect(await runEditorialCycle(deps, AT_RECAP)).toMatchObject({ kind: "tip" });
    expect(await runEditorialCycle(deps, AT_RECAP)).toMatchObject({ kind: "recap" });
    expect(x.timeline).toHaveLength(1);
  });

  it("does not post when the proof fails, and tries again on the next poll", async () => {
    const { deps, store, x } = setup();
    const publish = vi.spyOn(deps.proofs, "publish").mockRejectedValueOnce(new Error("devnet down"));
    expect(await runEditorialCycle(deps, AT_TIP)).toMatchObject({ status: "proof_failed" });
    expect(x.timeline).toHaveLength(0);
    expect(await store.listEditorial()).toHaveLength(0);
    expect(await runEditorialCycle(deps, AT_TIP)).toMatchObject({ status: "posted" });
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it("retries a failed post with the same text and proof, at most 3 attempts", async () => {
    const { deps, store } = setup();
    const publish = vi.spyOn(deps.proofs, "publish");
    const post = vi.spyOn(deps.x, "post").mockRejectedValue(new Error("HTTP 503"));
    for (let i = 0; i < 5; i += 1) await runEditorialCycle(deps, AT_TIP);
    expect(post).toHaveBeenCalledTimes(3);
    expect(new Set(post.mock.calls.map((call) => call[0]))).toEqual(new Set([composeTip(0)]));
    expect(publish).toHaveBeenCalledTimes(1);
    expect(await store.getEditorial("tip", "2026-10-09")).toMatchObject({ status: "post_failed", attempts: 3 });
    expect(await store.getCursor("editorial_tip_index")).toBeNull();
  });

  it("stops retrying once the late window has passed", async () => {
    const { deps } = setup();
    const post = vi.spyOn(deps.x, "post").mockRejectedValue(new Error("HTTP 503"));
    await runEditorialCycle(deps, AT_TIP);
    await runEditorialCycle(deps, new Date("2026-10-09T19:30:00Z"));
    expect(post.mock.calls.filter((call) => call[0] === composeTip(0))).toHaveLength(1);
  });

  it("marks an X duplicate and moves the rotation on", async () => {
    const { deps, store } = setup({ EDITORIAL_KINDS: "term" });
    vi.spyOn(deps.x, "post").mockRejectedValue(
      Object.assign(new Error("Request failed with code 403"), {
        code: 403,
        data: { detail: "You are not allowed to create a Tweet with duplicate content." },
      }),
    );
    expect(await runEditorialCycle(deps, new Date("2026-10-09T22:05:00Z"))).toMatchObject({ kind: "term", status: "duplicate" });
    expect(await store.getCursor("editorial_term_index")).toBe("1");
    expect((await store.getEditorial("term", "2026-10-09"))?.text).toBe(composeTerm(0));
  });

  it("never posts a record left in proved", async () => {
    const { deps, store } = setup();
    await store.saveEditorial({
      id: "stuck",
      kind: "tip",
      day: "2026-10-09",
      text: composeTip(0),
      contentHash: "h",
      payload: "p",
      txSignature: "mock_x",
      cluster: "mock",
      xPostId: null,
      status: "proved",
      recapSource: null,
      error: null,
      attempts: 0,
      createdAt: AT_TIP.toISOString(),
      updatedAt: AT_TIP.toISOString(),
    });
    const post = vi.spyOn(deps.x, "post");
    expect(await runEditorialCycle(deps, new Date("2026-10-09T13:30:00Z"))).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it("uses the activity recap when Lens checked 3 coins, without calling GeckoTerminal", async () => {
    const { deps, store, x } = setup({ EDITORIAL_KINDS: "recap" }, liveProvider());
    for (const [i, mint] of ["AaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaA1", "BbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbB2", "CcccccccccccccccccccccccccccccccccccccccccC3"].entries()) {
      await store.saveCheck(checkFixture(String(i), mint, { createdAt: "2026-10-09T09:00:00.000Z" }));
    }
    const fetchImpl = trendingFetch();
    const result = await runEditorialCycle(deps, AT_RECAP, { fetchImpl });
    expect(result).toMatchObject({ kind: "recap", status: "posted" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await store.getEditorial("recap", "2026-10-09"))?.recapSource).toBe("activity");
    expect(x.timeline[0]?.text).toContain("📊 Lens today");
  });

  it("falls back to the market recap on a quiet day", async () => {
    const { deps, store, x } = setup({ EDITORIAL_KINDS: "recap" }, liveProvider());
    const result = await runEditorialCycle(deps, AT_RECAP, { fetchImpl: trendingFetch() });
    expect(result).toMatchObject({ status: "posted" });
    expect((await store.getEditorial("recap", "2026-10-09"))?.recapSource).toBe("market");
    expect(x.timeline[0]?.text).toContain("📊 Trending on Solana today, Lens checked 3");
    expect(x.timeline[0]?.text).not.toMatch(/\$[A-Za-z]/);
  });

  it("never calls GeckoTerminal when EDITORIAL_MARKET_FALLBACK=false, and records the skip", async () => {
    const { deps, store, x } = setup({ EDITORIAL_KINDS: "recap", EDITORIAL_MARKET_FALLBACK: "false" }, liveProvider());
    const globalFetch = vi.spyOn(globalThis, "fetch");
    const fetchImpl = trendingFetch();
    expect(await runEditorialCycle(deps, AT_RECAP, { fetchImpl })).toMatchObject({ status: "skipped" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(globalFetch).not.toHaveBeenCalled();
    expect(x.timeline).toHaveLength(0);
    expect(await store.getEditorial("recap", "2026-10-09")).toMatchObject({ status: "skipped", text: "" });
    expect(await runEditorialCycle(deps, AT_RECAP, { fetchImpl })).toBeNull();
  });

  it("skips the recap when the trending API fails", async () => {
    const { deps, store, x } = setup({ EDITORIAL_KINDS: "recap" }, liveProvider());
    const down = vi.fn(async () => new Response("err", { status: 500 })) as unknown as typeof fetch;
    expect(await runEditorialCycle(deps, AT_RECAP, { fetchImpl: down })).toMatchObject({ status: "skipped" });
    expect((await store.getEditorial("recap", "2026-10-09"))?.error).toContain("trending pools");
    expect(x.timeline).toHaveLength(0);
  });

  it("never posts mock fixture numbers as a market recap", async () => {
    const { deps, x } = setup({ EDITORIAL_KINDS: "recap" });
    const fetchImpl = trendingFetch();
    expect(await runEditorialCycle(deps, AT_RECAP, { fetchImpl })).toMatchObject({ status: "skipped" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(x.timeline).toHaveLength(0);
  });

  it("never proves or posts in mock X mode, and only logs the text", async () => {
    const { deps, store, x } = setup({ X_MODE: "mock" });
    const publish = vi.spyOn(deps.proofs, "publish");
    const result = await runEditorialCycle(deps, AT_TIP);
    expect(result).toMatchObject({ kind: "tip", status: "would_post", text: composeTip(0) });
    expect(publish).not.toHaveBeenCalled();
    expect(x.timeline).toHaveLength(0);
    expect(await store.listEditorial()).toHaveLength(0);
  });
});
